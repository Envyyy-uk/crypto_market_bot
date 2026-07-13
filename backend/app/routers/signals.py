"""
GET /api/signals — історія сигналів із фільтрами. Завдання 20.

Фільтри з ТЗ: криптовалюта, тип сигналу, таймфрейм, дата.

Приклад:
    GET /api/signals?symbol=BTCUSDT&signalType=Buy&timeframe=1h&dateFrom=2026-07-01
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.db_models import Signal

router = APIRouter(tags=["signals"])


@router.get("/signals")
async def get_signals(
    symbol: str | None = Query(None, description="Напр. BTCUSDT"),
    signalType: str | None = Query(None, description="Strong Buy / Buy / Neutral / Sell / Strong Sell"),
    timeframe: str | None = Query(None, description="15m / 1h / 4h"),
    dateFrom: str | None = Query(None, description="ISO-дата, напр. 2026-07-01"),
    dateTo: str | None = Query(None, description="ISO-дата, напр. 2026-07-12"),
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    query = select(Signal).order_by(Signal.created_at.desc()).limit(limit)

    if symbol:
        query = query.where(Signal.symbol == symbol.upper())
    if signalType:
        query = query.where(Signal.signal_type == signalType)
    if timeframe:
        query = query.where(Signal.timeframe == timeframe)
    if dateFrom:
        try:
            query = query.where(Signal.created_at >= datetime.fromisoformat(dateFrom))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dateFrom format. Use YYYY-MM-DD.")
    if dateTo:
        try:
            query = query.where(Signal.created_at <= datetime.fromisoformat(dateTo))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid dateTo format. Use YYYY-MM-DD.")

    result = await session.execute(query)
    signals = result.scalars().all()

    return [
        {
            "id": s.id,
            "symbol": s.symbol,
            "timeframe": s.timeframe,
            "signal": s.signal_type,
            "score": s.score,
            "price": s.price,
            "riskLevel": s.risk_level,
            "reasons": json.loads(s.reasons) if s.reasons else [],
            "priceAfter15m": s.price_after_15m,
            "priceAfter1h": s.price_after_1h,
            "priceAfter4h": s.price_after_4h,
            "maxRisePct": s.max_rise_pct,
            "maxDropPct": s.max_drop_pct,
            "createdAt": s.created_at.isoformat(),
        }
        for s in signals
    ]


@router.get("/signals/stats")
async def signal_stats(session: AsyncSession = Depends(get_session)):
    """
    Точність системи (Завдання 21: "Можна оцінити точність роботи системи").
    Успіх: Buy/Strong Buy — ціна через 1h вища за вхід;
           Sell/Strong Sell — нижча. Neutral не оцінюється.
    """
    result = await session.execute(
        select(Signal).where(
            Signal.price_after_1h.is_not(None),
            Signal.signal_type != "Neutral",
        )
    )
    evaluated = list(result.scalars().all())

    wins = 0
    total_change = 0.0
    for s in evaluated:
        change_pct = (s.price_after_1h / s.price - 1) * 100 if s.price > 0 else 0.0
        is_buy = s.signal_type in ("Buy", "Strong Buy")
        if (is_buy and change_pct > 0) or (not is_buy and change_pct < 0):
            wins += 1
        # Результат "у напрямку сигналу": для Sell інвертуємо знак
        total_change += change_pct if is_buy else -change_pct

    total = len(evaluated)
    return {
        "evaluatedSignals": total,
        "successfulSignals": wins,
        "winRate": round(wins / total * 100, 1) if total else None,
        "averageResultPct": round(total_change / total, 2) if total else None,
        "note": "Success = price moved in the signal direction within 1 hour. Neutral signals are excluded.",
    }
