"""
GET /api/markets — Завдання 3 з ТЗ.

Приклад:
    GET /api/markets
    GET /api/markets?symbols=BTCUSDT,ETHUSDT
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import MarketTicker
from app.services.exchange import TRACKED_SYMBOLS, fetch_markets

logger = logging.getLogger("markets_router")
router = APIRouter(tags=["markets"])


@router.get("/markets", response_model=list[MarketTicker])
async def get_markets(
    symbols: str | None = Query(
        None, description="Список пар через кому, напр. BTCUSDT,ETHUSDT. За замовчуванням — усі відстежувані пари."
    )
):
    symbol_list = symbols.split(",") if symbols else TRACKED_SYMBOLS
    try:
        return await fetch_markets(symbol_list)
    except Exception:
        # Користувачу не показуємо технічні деталі — Завдання 23, але в лог пишемо.
        logger.exception("fetch_markets failed for %s", symbol_list)
        raise HTTPException(
            status_code=503,
            detail="Market data is temporarily unavailable. Please try again later.",
        )
