"""
Фоновий запис сигналів у базу. Завдання 20.

Кожні RECORD_INTERVAL_SEC аналізуємо пари з WATCHED (МВП з ТЗ: BTC/ETH/SOL
на 15m/1h/4h) і зберігаємо запис, коли тип сигналу ЗМІНИВСЯ порівняно
з останнім збереженим для цієї пари+таймфрейму. Так історія показує
переходи (Neutral -> Buy), а не тисячі однакових рядків.

Ця ж подія пізніше стане тригером push-сповіщень (Завдання 14-15).
"""

import asyncio
import json
import logging

from sqlalchemy import select

from app.analysis.indicators import compute_indicators
from app.analysis.risk import assess_risk
from app.analysis.signals import generate_signal
from app.db import SessionLocal
from app.models.db_models import Signal
from app.services.candles import fetch_candles

logger = logging.getLogger("signal_recorder")

# МВП (Завдання 32): три пари, три таймфрейми
WATCHED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
WATCHED_TIMEFRAMES = ["15m", "1h", "4h"]

RECORD_INTERVAL_SEC = 300  # перевірка кожні 5 хвилин


class SignalRecorder:
    def __init__(self):
        self._task: asyncio.Task | None = None
        # Кеш останнього типу сигналу: (symbol, timeframe) -> signal_type
        self._last: dict[tuple[str, str], str] = {}

    def start(self) -> None:
        self._task = asyncio.create_task(self._run_forever())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _run_forever(self) -> None:
        await self._load_last_signals()
        while True:
            try:
                await self._check_all()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Signal recorder cycle failed: %s", exc)
            await asyncio.sleep(RECORD_INTERVAL_SEC)

    async def _load_last_signals(self) -> None:
        """Після рестарту відновлюємо останні збережені сигнали, щоб не дублювати."""
        try:
            async with SessionLocal() as session:
                for symbol in WATCHED_SYMBOLS:
                    for tf in WATCHED_TIMEFRAMES:
                        result = await session.execute(
                            select(Signal.signal_type)
                            .where(Signal.symbol == symbol, Signal.timeframe == tf)
                            .order_by(Signal.created_at.desc())
                            .limit(1)
                        )
                        row = result.scalar_one_or_none()
                        if row:
                            self._last[(symbol, tf)] = row
        except Exception as exc:
            logger.warning("Could not load last signals: %s", exc)

    async def _check_all(self) -> None:
        for symbol in WATCHED_SYMBOLS:
            for tf in WATCHED_TIMEFRAMES:
                try:
                    await self._check_one(symbol, tf)
                except Exception as exc:
                    logger.warning("Signal check failed for %s %s: %s", symbol, tf, exc)
                await asyncio.sleep(0.5)  # ввічлива пауза між запитами до біржі

    async def _check_one(self, symbol: str, timeframe: str) -> None:
        candles = await fetch_candles(symbol, timeframe, 200)
        indicators = compute_indicators(candles)
        sig = generate_signal(indicators, candles)

        last = candles[-1]
        change_pct = (last.close / last.open - 1) * 100 if last.open > 0 else 0.0
        risk = assess_risk(indicators["price"], indicators["atr"], change_pct)

        key = (symbol, timeframe)
        if self._last.get(key) == sig["signal"]:
            return  # сигнал не змінився — не пишемо дублікат

        previous = self._last.get(key)
        self._last[key] = sig["signal"]

        async with SessionLocal() as session:
            session.add(
                Signal(
                    symbol=symbol,
                    timeframe=timeframe,
                    signal_type=sig["signal"],
                    score=sig["score"],
                    price=indicators["price"],
                    risk_level=risk["riskLevel"],
                    reasons=json.dumps(sig["reasons"]),
                )
            )
            await session.commit()

        logger.info(
            "Signal saved: %s %s %s -> %s (score %s)",
            symbol, timeframe, previous, sig["signal"], sig["score"],
        )


signal_recorder = SignalRecorder()
