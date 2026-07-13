"""
Сповіщення користувача. Завдання 14.

    POST   /api/alerts        — створити
    GET    /api/alerts        — список своїх сповіщень
    DELETE /api/alerts/{id}   — видалити

Типи умов:
    price_above   — ціна перевищила значення ("Повідомити, якщо BTC > 70000")
    price_below   — ціна опустилась нижче значення
    rsi_above     — RSI (1h) перевищив значення
    rsi_below     — RSI (1h) став нижчим ("...якщо RSI BTC стане нижчим за 30")
    signal_change — сигнал (1h) змінився на вказаний ("...на Strong Buy")

Сповіщення one-shot: після спрацювання is_active=False,
записуються fired_at і фактичне значення.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.db_models import Alert, User
from app.routers.auth import get_current_user
from app.services.exchange import TRACKED_SYMBOLS

router = APIRouter(prefix="/alerts", tags=["alerts"])

PRICE_CONDITIONS = {"price_above", "price_below"}
RSI_CONDITIONS = {"rsi_above", "rsi_below"}
SIGNAL_VALUES = {"Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"}
CONDITION_TYPES = PRICE_CONDITIONS | RSI_CONDITIONS | {"signal_change"}

MAX_ALERTS_PER_USER = 30


class AlertCreate(BaseModel):
    symbol: str = Field(..., examples=["BTCUSDT"])
    conditionType: str = Field(..., examples=["price_above"])
    conditionValue: str = Field(..., examples=["70000"])


def alert_public(a: Alert) -> dict:
    return {
        "id": a.id,
        "symbol": a.symbol,
        "conditionType": a.condition_type,
        "conditionValue": a.condition_value,
        "isActive": a.is_active,
        "firedAt": a.fired_at.isoformat() if a.fired_at else None,
        "firedValue": a.fired_value,
        "createdAt": a.created_at.isoformat(),
    }


def validate_alert(symbol: str, condition_type: str, condition_value: str) -> None:
    """Перевірка даних користувача (Завдання 23-24)."""
    if symbol not in TRACKED_SYMBOLS:
        raise HTTPException(status_code=400, detail=f"Unknown symbol: {symbol}")
    if condition_type not in CONDITION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition type. Use one of: {', '.join(sorted(CONDITION_TYPES))}",
        )
    if condition_type in PRICE_CONDITIONS:
        try:
            value = float(condition_value)
        except ValueError:
            raise HTTPException(status_code=400, detail="Price value must be a number.")
        if value <= 0:
            raise HTTPException(status_code=400, detail="Price value must be positive.")
    elif condition_type in RSI_CONDITIONS:
        try:
            value = float(condition_value)
        except ValueError:
            raise HTTPException(status_code=400, detail="RSI value must be a number.")
        if not 0 <= value <= 100:
            raise HTTPException(status_code=400, detail="RSI value must be between 0 and 100.")
    else:  # signal_change
        if condition_value not in SIGNAL_VALUES:
            raise HTTPException(
                status_code=400,
                detail=f"Signal value must be one of: {', '.join(sorted(SIGNAL_VALUES))}",
            )


@router.post("")
async def create_alert(
    body: AlertCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    symbol = body.symbol.upper()
    validate_alert(symbol, body.conditionType, body.conditionValue)

    count = len(
        (
            await session.execute(select(Alert.id).where(Alert.user_id == user.id))
        ).scalars().all()
    )
    if count >= MAX_ALERTS_PER_USER:
        raise HTTPException(
            status_code=400, detail=f"Alert limit reached ({MAX_ALERTS_PER_USER})."
        )

    alert = Alert(
        user_id=user.id,
        symbol=symbol,
        condition_type=body.conditionType,
        condition_value=body.conditionValue,
        is_active=True,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert_public(alert)


@router.get("")
async def list_alerts(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc())
    )
    return [alert_public(a) for a in result.scalars().all()]


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    alert = await session.get(Alert, alert_id)
    # Захист авторизованих маршрутів: чуже сповіщення виглядає як неіснуюче
    if alert is None or alert.user_id != user.id:
        raise HTTPException(status_code=404, detail="Alert not found.")
    await session.delete(alert)
    await session.commit()
    return {"deleted": alert_id}
