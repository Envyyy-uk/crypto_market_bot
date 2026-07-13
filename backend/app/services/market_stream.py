"""
Реальний потік цін через публічний Bybit WebSocket (spot). Завдання 4.

Архітектура:
- ОДНЕ спільне з'єднання до Bybit для всіх відстежуваних пар — ми не
  відкриваємо окремий WebSocket на кожного клієнта чи кожну монету
  ("не створювати декілька однакових підключень" з ТЗ).
- Frontend-клієнти підключаються до /ws/markets (усі пари одразу) або
  /ws/market/{symbol} (одна пара) і отримують push-оновлення без опитування.
- При розриві з'єднання з біржею — автоматичне перепідключення з
  експоненційною затримкою (1с → 2с → 4с … максимум 30с).
"""

import asyncio
import json
import logging
from collections import defaultdict

import websockets
from fastapi import WebSocket

from app.config import settings
from app.services.exchange import TRACKED_SYMBOLS, parse_ticker

logger = logging.getLogger("market_stream")

RECONNECT_MIN_DELAY = 1
RECONNECT_MAX_DELAY = 30
BYBIT_SUBSCRIBE_BATCH_SIZE = 10


class MarketStream:
    def __init__(self, symbols: list[str]):
        self.symbols = symbols
        self.cache: dict[str, dict] = {}
        # ключ "*" — підписники на всі пари (/ws/markets), інакше — символ пари
        self.subscribers: dict[str, set[WebSocket]] = defaultdict(set)
        self._task: asyncio.Task | None = None
        self.connected = False

    def start(self) -> None:
        self._task = asyncio.create_task(self._run_forever())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _run_forever(self) -> None:
        delay = RECONNECT_MIN_DELAY
        while True:
            try:
                await self._connect_once()
                delay = RECONNECT_MIN_DELAY  # успішна сесія — скидаємо backoff
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.connected = False
                logger.warning("Bybit WS disconnected (%s); reconnecting in %ss", exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX_DELAY)

    async def _connect_once(self) -> None:
        async with websockets.connect(settings.bybit_ws_url, ping_interval=20) as ws:
            self.connected = True
            args = [f"tickers.{s}" for s in self.symbols]
            # Bybit v5 public WS обмежує максимум 10 topic-ів на один subscribe (args size >10)
            for i in range(0, len(args), BYBIT_SUBSCRIBE_BATCH_SIZE):
                batch = args[i : i + BYBIT_SUBSCRIBE_BATCH_SIZE]
                await ws.send(json.dumps({"op": "subscribe", "args": batch}))
            logger.info("Subscribed to Bybit tickers for %s pairs", len(self.symbols))

            async for raw in ws:
                await self._handle_message(raw)

    async def _handle_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return  # биті дані ігноруємо — "перевіряти правильність отриманих даних"

        topic = msg.get("topic", "")
        data = msg.get("data")
        if not topic.startswith("tickers.") or not isinstance(data, dict):
            return  # це службове повідомлення (pong/ack), а не оновлення ціни

        symbol = data.get("symbol")
        if symbol not in self.symbols:
            return

        try:
            ticker = parse_ticker(data)
        except (KeyError, ValueError, TypeError):
            return  # неповний пакет — пропускаємо, дочекаємось наступного

        payload = ticker.model_dump()
        self.cache[symbol] = payload
        await self._broadcast(symbol, payload)

    async def _broadcast(self, symbol: str, payload: dict) -> None:
        message = json.dumps({"type": "update", "data": payload})
        targets = self.subscribers["*"] | self.subscribers[symbol]
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.subscribers["*"].discard(ws)
            self.subscribers[symbol].discard(ws)

    def snapshot(self, symbol: str | None = None) -> list[dict]:
        if symbol:
            item = self.cache.get(symbol)
            return [item] if item else []
        return list(self.cache.values())

    def subscribe(self, websocket: WebSocket, key: str) -> None:
        self.subscribers[key].add(websocket)

    def unsubscribe(self, websocket: WebSocket, key: str) -> None:
        self.subscribers[key].discard(websocket)


# Єдиний спільний екземпляр на весь застосунок
market_stream = MarketStream(TRACKED_SYMBOLS)
