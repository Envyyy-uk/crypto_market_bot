"""
Отримання історичних свічок (OHLCV). Завдання 5.

Джерело — Binance public REST (не Bybit): Bybit REST /v5/market/kline
повертає 403 Forbidden з деяких хмарних провайдерів (підтверджено на Render),
тоді як WebSocket-потік цін Bybit працює без проблем. Тому історичні свічки
беремо з Binance (той самий набір пар, ті самі формати таймфреймів), а живі
ціни й далі йдуть з Bybit WS (app/services/market_stream.py) — гібридна схема.

Binance endpoint: GET /api/v3/klines?symbol=...&interval=...&limit=...
Документація: https://developer.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
"""

import httpx

from app.config import settings
from app.models.schemas import Candle

# Формати таймфреймів з ТЗ збігаються з форматом, який очікує Binance.
SUPPORTED_INTERVALS: dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}

MAX_LIMIT = 1000


async def fetch_candles(symbol: str, interval: str, limit: int = 500) -> list[Candle]:
    if interval not in SUPPORTED_INTERVALS:
        raise ValueError(
            f"Unsupported interval '{interval}'. Use one of: {', '.join(SUPPORTED_INTERVALS)}"
        )

    limit = max(1, min(limit, MAX_LIMIT))
    binance_interval = SUPPORTED_INTERVALS[interval]

    url = f"{settings.binance_rest_url}/api/v3/klines"
    params = {
        "symbol": symbol,
        "interval": binance_interval,
        "limit": limit,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        raw_list = response.json()

    if not raw_list:
        raise ValueError(f"No candle data returned for {symbol} ({interval})")

    # Binance: [openTime, open, high, low, close, volume, closeTime, ...] — вже за зростанням часу.
    return [
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
