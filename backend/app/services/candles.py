"""
Отримання історичних свічок (OHLCV). Завдання 5.

Bybit v5 endpoint: GET /v5/market/kline?category=spot&symbol=...&interval=...&limit=...
Документація: https://bybit-exchange.github.io/docs/v5/market/kline
"""

import httpx

from app.config import settings
from app.models.schemas import Candle

# Підтримувані таймфрейми з ТЗ -> формат інтервалу, який очікує Bybit
SUPPORTED_INTERVALS: dict[str, str] = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
}

MAX_LIMIT = 1000


async def fetch_candles(symbol: str, interval: str, limit: int = 500) -> list[Candle]:
    if interval not in SUPPORTED_INTERVALS:
        raise ValueError(
            f"Unsupported interval '{interval}'. Use one of: {', '.join(SUPPORTED_INTERVALS)}"
        )

    limit = max(1, min(limit, MAX_LIMIT))
    bybit_interval = SUPPORTED_INTERVALS[interval]

    url = f"{settings.bybit_rest_url}/v5/market/kline"
    params = {
        "category": "spot",
        "symbol": symbol,
        "interval": bybit_interval,
        "limit": limit,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    raw_list = payload.get("result", {}).get("list", [])
    if not raw_list:
        raise ValueError(f"No candle data returned for {symbol} ({interval})")

    candles = [
        Candle(
            time=int(row[0]),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=float(row[5]),
        )
        for row in raw_list
    ]

    # Bybit віддає свічки від найновішої до найстарішої — розвертаємо для графіка
    candles.sort(key=lambda c: c.time)
    return candles
