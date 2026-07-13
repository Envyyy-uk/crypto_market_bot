"""
Підключення до біржі (REST). Завдання 3.

Використовуємо публічний Bybit v5 endpoint /v5/market/tickers?category=spot,
який не потребує API-ключа для читання ринкових даних.
Реальний потік (WebSocket) — див. app/services/market_stream.py (Завдання 4).

Документація: https://bybit-exchange.github.io/docs/v5/market/tickers
"""

import httpx

from app.config import settings
from app.models.schemas import MarketTicker

# Великі, ліквідні монети
# TONUSDT виключено — не торгується на Bybit spot (лише ф'ючерси), REST/WS повертають "Invalid symbol"
MAJOR_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT",
    "ADAUSDT", "DOGEUSDT", "TRXUSDT", "AVAXUSDT",
    "LINKUSDT", "DOTUSDT", "LTCUSDT", "BCHUSDT", "ETCUSDT",
]

# Менш капіталізовані / нішеві монети та мемкоїни
# MKRUSDT виключено — делістингований з Bybit spot, REST повертає порожні свічки
ALT_SYMBOLS = [
    "ATOMUSDT", "UNIUSDT", "NEARUSDT", "ICPUSDT", "APTUSDT",
    "ARBUSDT", "OPUSDT", "FILUSDT", "SUIUSDT", "INJUSDT",
    "XLMUSDT", "HBARUSDT", "VETUSDT", "ALGOUSDT", "RENDERUSDT",
    "IMXUSDT", "GRTUSDT", "AAVEUSDT", "SANDUSDT",
    "MANAUSDT", "AXSUSDT", "EGLDUSDT", "GALAUSDT", "CHZUSDT",
    "ENSUSDT", "LDOUSDT", "CRVUSDT", "DYDXUSDT", "JUPUSDT",
    "PYTHUSDT", "STRKUSDT", "ORDIUSDT", "BONKUSDT", "PEPEUSDT",
    "SHIBUSDT", "WIFUSDT", "FLOKIUSDT", "SEIUSDT", "TIAUSDT",
    "JASMYUSDT",
]

# Повний список пар, які бот відстежує (Завдання 3-4)
TRACKED_SYMBOLS = MAJOR_SYMBOLS + ALT_SYMBOLS


def parse_ticker(data: dict) -> MarketTicker:
    """Bybit повертає price24hPcnt як частку (0.0245 = 2.45%), а не готовий відсоток."""
    return MarketTicker(
        symbol=data["symbol"],
        price=float(data["lastPrice"]),
        change24h=round(float(data["price24hPcnt"]) * 100, 2),
        high24h=float(data["highPrice24h"]),
        low24h=float(data["lowPrice24h"]),
        # turnover24h — обсяг у котирувальній валюті (USDT)
        volume24h=float(data["turnover24h"]),
    )


async def fetch_ticker(symbol: str) -> MarketTicker:
    """Отримати 24-годинну статистику для однієї пари."""
    url = f"{settings.bybit_rest_url}/v5/market/tickers"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params={"category": "spot", "symbol": symbol})
        response.raise_for_status()
        payload = response.json()

    ticker_list = payload.get("result", {}).get("list", [])
    if not ticker_list:
        raise ValueError(f"No ticker data returned for {symbol}")

    return parse_ticker(ticker_list[0])


async def fetch_markets(symbols: list[str] | None = None) -> list[MarketTicker]:
    """
    Отримати статистику для списку пар (за замовчуванням — усі TRACKED_SYMBOLS).

    Робимо ОДИН запит без параметра symbol — Bybit повертає всі спотові пари
    одразу, і ми фільтруємо потрібні локально. Це набагато ефективніше, ніж
    окремий HTTP-запит на кожну з 50+ монет.
    """
    wanted = symbols or TRACKED_SYMBOLS
    wanted_set = set(wanted)

    url = f"{settings.bybit_rest_url}/v5/market/tickers"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params={"category": "spot"})
        response.raise_for_status()
        payload = response.json()

    raw_list = payload.get("result", {}).get("list", [])
    by_symbol = {item["symbol"]: item for item in raw_list if item.get("symbol") in wanted_set}

    results: list[MarketTicker] = []
    for symbol in wanted:  # зберігаємо порядок TRACKED_SYMBOLS у відповіді
        item = by_symbol.get(symbol)
        if not item:
            continue  # пара тимчасово відсутня на біржі — пропускаємо, не ламаємо відповідь
        try:
            results.append(parse_ticker(item))
        except (KeyError, ValueError, TypeError):
            continue
    return results
