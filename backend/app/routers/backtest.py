"""
GET /api/backtest/{symbol} — прогін стратегії по історії. Завдання 22.

Приклад:
    GET /api/backtest/BTCUSDT?interval=1h&horizon=12
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.backtesting.backtest import run_backtest
from app.services.candles import SUPPORTED_INTERVALS, fetch_candles
from app.services.exchange import TRACKED_SYMBOLS

logger = logging.getLogger("backtest_router")
router = APIRouter(tags=["backtest"])


@router.get("/backtest/{symbol}")
async def backtest(
    symbol: str,
    interval: str = Query("1h", description=f"Один з: {', '.join(SUPPORTED_INTERVALS)}"),
    horizon: int = Query(12, ge=1, le=100, description="Через скільки свічок оцінювати результат"),
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
        candles = await fetch_candles(symbol, interval, 1000)
        result = run_backtest(candles, horizon)
    except ValueError:
        raise HTTPException(
            status_code=422, detail="Not enough historical data for a backtest."
        )
    except Exception:
        logger.exception("run_backtest failed for %s %s", symbol, interval)
        raise HTTPException(
            status_code=503,
            detail="Market data is temporarily unavailable. Please try again later.",
        )

    return {"symbol": symbol, "interval": interval, **result}
