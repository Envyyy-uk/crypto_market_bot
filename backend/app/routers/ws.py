"""
WebSocket-и для оновлення цін у реальному часі. Завдання 4.

    WS /ws/markets           — усі відстежувані пари одразу (для головної сторінки)
    WS /ws/market/{symbol}   — одна пара (для сторінки аналізу)

Приклад:
    /ws/market/BTCUSDT

Протокол повідомлень від сервера:
    {"type": "snapshot", "data": [...]}   — початковий стан одразу після підключення
    {"type": "update", "data": {...}}     — оновлення однієї пари в реальному часі
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.exchange import TRACKED_SYMBOLS
from app.services.market_stream import market_stream

logger = logging.getLogger("ws_router")
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/markets")
async def ws_all_markets(websocket: WebSocket):
    await websocket.accept()
    market_stream.subscribe(websocket, "*")
    await websocket.send_text(
        json.dumps({"type": "snapshot", "data": market_stream.snapshot()})
    )
    try:
        while True:
            # Клієнт нічого не надсилає — просто тримаємо з'єднання відкритим
            # і чекаємо на розрив, щоб коректно прибрати підписку.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        market_stream.unsubscribe(websocket, "*")


@router.websocket("/ws/market/{symbol}")
async def ws_single_market(websocket: WebSocket, symbol: str):
    symbol = symbol.upper()
    if symbol not in TRACKED_SYMBOLS:
        await websocket.close(code=4404, reason=f"Unknown symbol: {symbol}")
        return

    await websocket.accept()
    market_stream.subscribe(websocket, symbol)
    await websocket.send_text(
        json.dumps({"type": "snapshot", "data": market_stream.snapshot(symbol)})
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        market_stream.unsubscribe(websocket, symbol)
