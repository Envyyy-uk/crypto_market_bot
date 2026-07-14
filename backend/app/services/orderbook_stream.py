"""
Стрічка ордербука (глибина ринку) — живі bid/ask з Bybit WS.

На відміну від тікерів (одне спільне з'єднання на ВСІ пари), ордербук
важчий і зазвичай потрібен лише для ОДНІЄЇ пари, яку зараз дивиться
користувач. Тому тут — окреме WS-з'єднання на кожну пару, що відкривається
за першим підписником і закривається, коли підписників не лишилось.

Bybit v5 spot: перше повідомлення після підписки — "snapshot" (повний
стан), далі йдуть "delta" (лише зміни: розмір 0 -> рівень видалити).
Документація: https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook
"""

import asyncio
import json
import logging

import websockets
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger("orderbook_stream")

RECONNECT_MIN_DELAY = 1
RECONNECT_MAX_DELAY = 30
ORDERBOOK_DEPTH = 50  # глибина підписки в Bybit (1, 50 або 200 для spot)
DISPLAY_LEVELS = 15  # скільки рівнів віддаємо клієнту


class OrderBookStream:
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.bids: dict[float, float] = {}
        self.asks: dict[float, float] = {}
        self.subscribers: set[WebSocket] = set()
        self._task: asyncio.Task | None = None
        self.ready = False

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
                delay = RECONNECT_MIN_DELAY
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.ready = False
                logger.warning("Orderbook WS for %s disconnected (%s); retrying in %ss", self.symbol, exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, RECONNECT_MAX_DELAY)

    async def _connect_once(self) -> None:
        async with websockets.connect(settings.bybit_ws_url, ping_interval=20) as ws:
            topic = f"orderbook.{ORDERBOOK_DEPTH}.{self.symbol}"
            await ws.send(json.dumps({"op": "subscribe", "args": [topic]}))
            async for raw in ws:
                await self._handle_message(raw)

    async def _handle_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        topic = msg.get("topic", "")
        data = msg.get("data")
        if not topic.startswith("orderbook.") or not isinstance(data, dict):
            return

        msg_type = msg.get("type")
        try:
            if msg_type == "snapshot":
                self.bids = {float(p): float(s) for p, s in data.get("b", [])}
                self.asks = {float(p): float(s) for p, s in data.get("a", [])}
                self.ready = True
            elif msg_type == "delta":
                self._apply_delta(self.bids, data.get("b", []))
                self._apply_delta(self.asks, data.get("a", []))
        except (KeyError, ValueError, TypeError):
            return  # неповний/биті пакет — чекаємо наступний

        await self._broadcast()

    @staticmethod
    def _apply_delta(book: dict[float, float], levels: list) -> None:
        for price_str, size_str in levels:
            price, size = float(price_str), float(size_str)
            if size == 0:
                book.pop(price, None)
            else:
                book[price] = size

    def snapshot(self) -> dict:
        top_bids = sorted(self.bids.items(), key=lambda x: -x[0])[:DISPLAY_LEVELS]
        top_asks = sorted(self.asks.items(), key=lambda x: x[0])[:DISPLAY_LEVELS]
        return {
            "bids": [{"price": p, "size": s} for p, s in top_bids],
            "asks": [{"price": p, "size": s} for p, s in top_asks],
        }

    async def _broadcast(self) -> None:
        if not self.subscribers:
            return
        message = json.dumps({"type": "update", "data": self.snapshot()})
        dead: list[WebSocket] = []
        for ws in self.subscribers:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.subscribers.discard(ws)


class OrderBookManager:
    """Тримає по одному OrderBookStream на кожну пару, яку зараз хтось дивиться."""

    def __init__(self):
        self.streams: dict[str, OrderBookStream] = {}

    def subscribe(self, symbol: str, websocket: WebSocket) -> OrderBookStream:
        stream = self.streams.get(symbol)
        if stream is None:
            stream = OrderBookStream(symbol)
            stream.start()
            self.streams[symbol] = stream
        stream.subscribers.add(websocket)
        return stream

    def unsubscribe(self, symbol: str, websocket: WebSocket) -> None:
        stream = self.streams.get(symbol)
        if stream is None:
            return
        stream.subscribers.discard(websocket)
        if not stream.subscribers:
            stream.stop()
            del self.streams[symbol]

    def stop_all(self) -> None:
        for stream in self.streams.values():
            stream.stop()
        self.streams.clear()


orderbook_manager = OrderBookManager()
