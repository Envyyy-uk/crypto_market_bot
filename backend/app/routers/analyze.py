"""
GET /api/analyze/{symbol} — повний аналіз пари. Завдання 8-9, 11.

Об'єднує: індикатори + тренд + сигнал із поясненнями + рівень ризику.
Це API-основа для сторінки аналізу (Завдання 10).

Приклад відповіді:
    {
      "symbol": "BTCUSDT",
      "interval": "1h",
      "trend": "bullish",
      "signal": "Buy",
      "score": 5,
      "maxScore": 8,
      "riskLevel": "Medium",
      "reasons": ["EMA 20 is above EMA 50", ...],
      "indicators": { ... },
      "updatedAt": 1720800000000
    }
"""

import logging
import time

from fastapi import APIRouter, HTTPException, Query

from app.analysis.indicators import compute_indicators
from app.analysis.risk import assess_risk
from app.analysis.signals import generate_signal
from app.analysis.trend import detect_trend
from app.services.candles import SUPPORTED_INTERVALS, fetch_candles
from app.services.exchange import TRACKED_SYMBOLS

logger = logging.getLogger("analyze_router")
router = APIRouter(tags=["analysis"])


@router.get("/analyze/{symbol}")
async def analyze(
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
        indicators = compute_indicators(candles)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Not enough market data to analyze this pair.",
        )
    except Exception:
        logger.exception("analyze failed for %s %s", symbol, interval)
        raise HTTPException(
            status_code=503,
            detail="Market data is temporarily unavailable. Please try again later.",
        )

    trend = detect_trend(indicators["price"], indicators["ema20"], indicators["ema50"])
    signal = generate_signal(indicators, candles)

    last = candles[-1]
    last_change_pct = (last.close / last.open - 1) * 100 if last.open > 0 else 0.0
    risk = assess_risk(indicators["price"], indicators["atr"], last_change_pct)

    return {
        "symbol": symbol,
        "interval": interval,
        "price": indicators["price"],
        "trend": trend,
        "signal": signal["signal"],
        "score": signal["score"],
        "maxScore": signal["maxScore"],
        "reasons": signal["reasons"],
        "support": signal["support"],
        "resistance": signal["resistance"],
        "riskLevel": risk["riskLevel"],
        "riskWarning": risk["warning"],
        "atrPct": risk["atrPct"],
        "indicators": indicators,
        "updatedAt": int(time.time() * 1000),
    }
