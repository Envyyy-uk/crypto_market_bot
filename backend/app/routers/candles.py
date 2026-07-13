"""
GET /api/candles/{symbol} — Завдання 5 з ТЗ.

Приклад:
    GET /api/candles/BTCUSDT?interval=15m&limit=500
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Candle
from app.services.candles import SUPPORTED_INTERVALS, fetch_candles
from app.services.exchange import TRACKED_SYMBOLS

logger = logging.getLogger("candles_router")
router = APIRouter(tags=["candles"])


@router.get("/candles/{symbol}", response_model=list[Candle])
async def get_candles(
    symbol: str,
    interval: str = Query("15m", description=f"Один з: {', '.join(SUPPORTED_INTERVALS)}"),
    limit: int = Query(500, ge=1, le=1000, description="Кількість свічок (макс. 1000)"),
):
    symbol = symbol.upper()
    if symbol not in TRACKED_SYMBOLS:
        raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol}")

    if interval not in SUPPORTED_INTERVALS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid interval. Use one of: {', '.join(SUPPORTED_INTERVALS)}",
        )

    try:
        return await fetch_candles(symbol, interval, limit)
    except Exception:
        # Користувачу не показуємо технічні деталі — Завдання 23, але в лог пишемо.
        logger.exception("fetch_candles failed for %s %s", symbol, interval)
        raise HTTPException(
            status_code=503,
            detail="Market data is temporarily unavailable. Please try again later.",
        )
