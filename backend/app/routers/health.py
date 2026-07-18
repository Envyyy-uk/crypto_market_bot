"""
GET /health — перевірка стану системи (Завдання 27).

Приклад відповіді:
    {
      "status": "online",
      "exchangeConnection": "connected",
      "database": "connected",
      "uptimeSec": 3600,
      "trackedPairs": 56,
      "wsClients": 2
    }
"""

import time

from fastapi import APIRouter

import app.db as db
from app.services.exchange import TRACKED_SYMBOLS
from app.services.market_stream import market_stream

router = APIRouter(tags=["health"])

_started = time.time()


# HEAD потрібен аптайм-моніторам (UptimeRobot шле HEAD за замовчуванням) —
# без нього вони отримують 405 і вважають сервіс "впавшим".
@router.head("/health")
@router.get("/health")
def health_check():
    ws_clients = sum(len(subs) for subs in market_stream.subscribers.values())
    return {
        "status": "online",
        "exchangeConnection": "connected" if market_stream.connected else "connecting",
        "database": "connected" if db.db_connected else "disconnected",
        "uptimeSec": int(time.time() - _started),
        "trackedPairs": len(TRACKED_SYMBOLS),
        "wsClients": ws_clients,
    }
