"""
Фонова перевірка умов сповіщень. Завдання 14.

Кожні CHECK_INTERVAL_SEC:
  - ціни беремо з кешу market_stream (безкоштовно, вже оновлюються по WS);
  - RSI і сигнал рахуємо на 1h-свічках лише для пар, де є відповідні alert-и.

Коли умова виконалась: alert деактивується (one-shot), записується
fired_at/fired_value і викликаються нотифікатори. Зараз нотифікатор —
журнал; у Завданні 15 сюди підключиться Web Push.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from sqlalchemy import select

from app.analysis.indicators import compute_indicators
from app.analysis.signals import generate_signal
from app.db import SessionLocal
from app.models.db_models import Alert
from app.services.candles import fetch_candles
from app.services.market_stream import market_stream

logger = logging.getLogger("alert_checker")

CHECK_INTERVAL_SEC = 60
ANALYSIS_TIMEFRAME = "1h"

# Нотифікатор: (user_id, title, message, symbol) -> None
Notifier = Callable[[int, str, str, str], Awaitable[None]]


async def log_notifier(user_id: int, title: str, message: str, symbol: str) -> None:
    logger.info("NOTIFY user=%s [%s] %s — %s", user_id, symbol, title, message)


class AlertChecker:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self.notifiers: list[Notifier] = [log_notifier]

    def add_notifier(self, notifier: Notifier) -> None:
        self.notifiers.append(notifier)

    def start(self) -> None:
        self._task = asyncio.create_task(self._run_forever())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _run_forever(self) -> None:
        while True:
            try:
                await self._check_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Alert check cycle failed: %s", exc)
            await asyncio.sleep(CHECK_INTERVAL_SEC)

    async def _check_cycle(self) -> None:
        async with SessionLocal() as session:
            result = await session.execute(select(Alert).where(Alert.is_active == True))  # noqa: E712
            alerts = list(result.scalars().all())

        if not alerts:
            return

        # Аналіз (RSI/сигнал) рахуємо один раз на пару, а не на кожен alert
        analysis_symbols = {
            a.symbol for a in alerts if a.condition_type.startswith("rsi") or a.condition_type == "signal_change"
        }
        analysis: dict[str, dict] = {}
        for symbol in analysis_symbols:
            try:
                candles = await fetch_candles(symbol, ANALYSIS_TIMEFRAME, 200)
                ind = compute_indicators(candles)
                sig = generate_signal(ind, candles)
                analysis[symbol] = {"rsi": ind["rsi"], "signal": sig["signal"]}
            except Exception as exc:
                logger.warning("Analysis for alerts failed (%s): %s", symbol, exc)
            await asyncio.sleep(0.3)

        for alert in alerts:
            fired, actual = self._evaluate(alert, analysis)
            if fired:
                await self._fire(alert, actual)

    def _evaluate(self, alert: Alert, analysis: dict[str, dict]) -> tuple[bool, str]:
        ctype = alert.condition_type

        if ctype in ("price_above", "price_below"):
            cached = market_stream.cache.get(alert.symbol)
            if not cached:
                return False, ""
            price = float(cached["price"])
            target = float(alert.condition_value)
            if ctype == "price_above" and price > target:
                return True, f"{price:g}"
            if ctype == "price_below" and price < target:
                return True, f"{price:g}"
            return False, ""

        data = analysis.get(alert.symbol)
        if not data:
            return False, ""

        if ctype in ("rsi_above", "rsi_below"):
            rsi = float(data["rsi"])
            target = float(alert.condition_value)
            if ctype == "rsi_above" and rsi > target:
                return True, f"{rsi:.1f}"
            if ctype == "rsi_below" and rsi < target:
                return True, f"{rsi:.1f}"
            return False, ""

        if ctype == "signal_change":
            if data["signal"] == alert.condition_value:
                return True, data["signal"]

        return False, ""

    async def _fire(self, alert: Alert, actual_value: str) -> None:
        async with SessionLocal() as session:
            db_alert = await session.get(Alert, alert.id)
            if db_alert is None or not db_alert.is_active:
                return  # уже оброблено паралельним циклом
            db_alert.is_active = False
            db_alert.fired_at = datetime.now(timezone.utc)
            db_alert.fired_value = actual_value
            await session.commit()

        title, message = self._format_message(alert, actual_value)
        for notifier in self.notifiers:
            try:
                await notifier(alert.user_id, title, message, alert.symbol)
            except Exception as exc:
                logger.warning("Notifier failed for alert %s: %s", alert.id, exc)

    @staticmethod
    def _format_message(alert: Alert, actual: str) -> tuple[str, str]:
        pair = alert.symbol.replace("USDT", "/USDT")
        ctype = alert.condition_type
        if ctype == "price_above":
            return f"{pair} price alert", f"Price rose above {alert.condition_value} USDT (now {actual})."
        if ctype == "price_below":
            return f"{pair} price alert", f"Price fell below {alert.condition_value} USDT (now {actual})."
        if ctype == "rsi_above":
            return f"{pair} RSI alert", f"RSI rose above {alert.condition_value} (now {actual})."
        if ctype == "rsi_below":
            return f"{pair} RSI alert", f"RSI fell below {alert.condition_value} (now {actual})."
        return f"{pair} signal update", f"Signal changed to {actual}."


alert_checker = AlertChecker()
