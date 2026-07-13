"""
Список обраних криптовалют. Завдання 12 (backend-частина).

Для неавторизованих обране живе в localStorage на frontend.
Після входу список синхронізується сюди:

    GET    /api/favourites            -> ["BTCUSDT", "SOLUSDT", ...]
    PUT    /api/favourites            {symbols: [...]} — повна заміна (add/remove/reorder)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.db_models import FavouriteAsset, User
from app.routers.auth import get_current_user
from app.services.exchange import TRACKED_SYMBOLS

router = APIRouter(prefix="/favourites", tags=["favourites"])


class FavouritesUpdate(BaseModel):
    symbols: list[str]


@router.get("")
async def get_favourites(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(FavouriteAsset)
        .where(FavouriteAsset.user_id == user.id)
        .order_by(FavouriteAsset.position)
    )
    return [f.symbol for f in result.scalars().all()]


@router.put("")
async def replace_favourites(
    body: FavouritesUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Повна заміна списку: покриває додавання, видалення і зміну порядку
    одним запитом. Порядок масиву = порядок у списку користувача.
    """
    symbols = [s.upper() for s in body.symbols]

    unknown = [s for s in symbols if s not in TRACKED_SYMBOLS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown symbols: {', '.join(unknown)}")
    if len(symbols) != len(set(symbols)):
        raise HTTPException(status_code=400, detail="Duplicate symbols in the list.")
    if len(symbols) > 50:
        raise HTTPException(status_code=400, detail="Too many favourites (max 50).")

    await session.execute(delete(FavouriteAsset).where(FavouriteAsset.user_id == user.id))
    for position, symbol in enumerate(symbols):
        session.add(FavouriteAsset(user_id=user.id, symbol=symbol, position=position))
    await session.commit()

    return {"symbols": symbols}
