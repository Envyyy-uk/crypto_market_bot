"""
GET /api/indicators/{symbol} — значення технічних індикаторів. Завдання 7.

Приклад:
    GET /api/indicators/BTCUSDT?interval=1h
"""

from fastapi import APIRouter, HTTPException, Query

from app.analysis.indicators import compute_indicators
from app.services.candles import SUPPORTED_INTERVALS, fetch_candles
from app.services.exchange import TRACKED_SYMBOLS

router = APIRouter(tags=["analysis"])


@router.get("/indicators/{symbol}")
async def get_indicators(
    symbol: str,
    interval: str = Query("1h", description=f"Один з: {', '.join(SUPPORTED_INTERVALS)}"),
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
        candles = await fetch_candles(symbol, interval, 200)
        result = compute_indicators(candles)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Not enough market data to compute indicators for this pair.",
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Market data is temporarily unavailable. Please try again later.",
        )

    return {"symbol": symbol, "interval": interval, **result}
