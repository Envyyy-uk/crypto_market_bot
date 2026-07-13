"""
Crypto Market Analysis Bot — Backend entrypoint.

Запуск локально:
    cd backend
    python -m venv venv && source venv/bin/activate   # Windows: venv\\Scripts\\activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Після запуску:
    http://localhost:8000/health
    http://localhost:8000/api/markets
    http://localhost:8000/docs   (Swagger UI)
"""

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.db import init_db
from app.routers import alerts, analyze, auth, backtest, candles, favourites, health, indicators, markets, push, signals, ws
from app.services.market_stream import market_stream
from app.services.outcome_checker import outcome_checker
from app.routers.push import send_push_to_user
from app.services.alert_checker import alert_checker
from app.services.signal_recorder import signal_recorder


# Журнали (Завдання 27): консоль + файл app.log поруч із backend
# Шлях анкеримо до app/, а не до cwd процесу — uvicorn можуть запускати з різних місць.
LOG_PATH = Path(__file__).resolve().parent.parent / "app.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_PATH)],
)
logger = logging.getLogger("main")

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()          # створюємо таблиці (Завдання 19)
    market_stream.start()    # спільне WS-з'єднання до Bybit (Завдання 4)
    signal_recorder.start()  # фоновий запис сигналів у БД (Завдання 20)
    alert_checker.add_notifier(send_push_to_user)  # доставка push (Завдання 15)
    alert_checker.start()    # фонова перевірка сповіщень (Завдання 14)
    outcome_checker.start()  # заповнення результатів сигналів (Завдання 21)
    yield
    outcome_checker.stop()
    alert_checker.stop()
    signal_recorder.stop()
    market_stream.stop()


app = FastAPI(
    title="Crypto Market Analysis Bot API",
    version="0.1.0",
    description="Backend для аналізу криптовалютного ринку (Завдання 1-11, 19-20 з ТЗ).",
    lifespan=lifespan,
)

# Frontend (Vite dev server) звертається сюди з іншого порту — потрібен CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


# Глобальний обробник (Завдання 23): технічні деталі — у журнал, користувачу — просте повідомлення
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again later."},
    )


app.include_router(health.router)
app.include_router(markets.router, prefix="/api")
app.include_router(candles.router, prefix="/api")
app.include_router(indicators.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(signals.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(favourites.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(backtest.router, prefix="/api")
app.include_router(ws.router)


@app.get("/")
def root():
    return {"message": "Crypto Market Analysis Bot API. Див. /docs"}
