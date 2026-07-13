"""
Перевірка результатів сигналів. Завдання 21.

Кожні CHECK_INTERVAL_SEC знаходимо сигнали з незаповненими результатами,
чий цільовий час уже минув, і дозаповнюємо з історичних 5m-свічок:

    price_after_15m / 1h / 4h — close свічки, що містить момент t0 + Δ
    max_rise_pct / max_drop_pct — екстремуми high/low у вікні [t0, t0+4h]

5m-свічки з limit=1000 покривають ~3.5 доби назад — достатньо, поки сервер
працює регулярно. Старіші прогалини лишаються порожніми ("pending" в UI).
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import or_, select

from app.db import SessionLocal
from app.models.db_models import Signal
from app.services.candles import fetch_candles
from app.models.schemas import Candle

logger = logging.getLogger("outcome_checker")

CHECK_INTERVAL_SEC = 300
CANDLE_INTERVAL = "5m"
CANDLE_MS = 5 * 60 * 1000

DELTAS_MS = {
    "price_after_15m": 15 * 60 * 1000,
    "price_after_1h": 60 * 60 * 1000,
    "price_after_4h": 4 * 60 * 60 * 1000,
}
WINDOW_4H_MS = DELTAS_MS["price_after_4h"]


# ---------- чисті функції (тестуються без БД/мережі) ----------

def price_at(candles: list[Candle], target_ms: int) -> float | None:
    """Close свічки, чиє вікно [open_time, open_time + 5m) містить target_ms."""
    for c in candles:
        if c.time <= target_ms < c.time + CANDLE_MS:
            return c.close
    return None


def extremes(candles: list[Candle], start_ms: int, end_ms: int, entry: float) -> tuple[float, float] | None:
    """
    (max_rise_pct, max_drop_pct) у вікні [start_ms, end_ms].
    None, якщо у вікні немає жодної свічки або entry некоректний.
    """
    if entry <= 0:
        return None
    window = [c for c in candles if start_ms <= c.time < end_ms]
    if not window:
        return None
    highest = max(c.high for c in window)
    lowest = min(c.low for c in window)
    rise = (highest / entry - 1) * 100
    drop = (lowest / entry - 1) * 100
    return round(rise, 2), round(drop, 2)


# ---------- фоновий сервіс ----------

class OutcomeChecker:
    def __init__(self):
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._run_forever())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def _run_forever(self) -> None:
        while True:
            try:
                await self._fill_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.error("Outcome check cycle failed: %s", exc)
            await asyncio.sleep(CHECK_INTERVAL_SEC)

    async def _fill_cycle(self) -> None:
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        async with SessionLocal() as session:
            result = await session.execute(
                select(Signal)
                .where(
                    or_(
                        Signal.price_after_15m.is_(None),
                        Signal.price_after_1h.is_(None),
                        Signal.price_after_4h.is_(None),
                        Signal.max_rise_pct.is_(None),
                    )
                )
                .order_by(Signal.created_at.desc())
                .limit(200)
            )
            pending = list(result.scalars().all())

        # Лишаємо сигнали, де хоч один цільовий час уже настав
        def created_ms(s: Signal) -> int:
            dt = s.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)

        actionable = [s for s in pending if now_ms - created_ms(s) >= DELTAS_MS["price_after_15m"]]
        if not actionable:
            return

        symbols = {s.symbol for s in actionable}
        candles_by_symbol: dict[str, list[Candle]] = {}
        for symbol in symbols:
            try:
                candles_by_symbol[symbol] = await fetch_candles(symbol, CANDLE_INTERVAL, 1000)
            except Exception as exc:
                logger.warning("Outcome candles fetch failed (%s): %s", symbol, exc)
            await asyncio.sleep(0.3)

        filled = 0
        async with SessionLocal() as session:
            for s in actionable:
                candles = candles_by_symbol.get(s.symbol)
                if not candles:
                    continue

                db_signal = await session.get(Signal, s.id)
                if db_signal is None:
                    continue

                t0 = created_ms(s)
                changed = False

                for field, delta in DELTAS_MS.items():
                    if getattr(db_signal, field) is None and now_ms >= t0 + delta:
                        price = price_at(candles, t0 + delta)
                        if price is not None:
                            setattr(db_signal, field, price)
                            changed = True

                # Екстремуми фіксуємо, коли 4h-вікно повністю минуло
                if db_signal.max_rise_pct is None and now_ms >= t0 + WINDOW_4H_MS:
                    ext = extremes(candles, t0, t0 + WINDOW_4H_MS, db_signal.price)
                    if ext is not None:
                        db_signal.max_rise_pct, db_signal.max_drop_pct = ext
                        changed = True

                if changed:
                    filled += 1

            await session.commit()

        if filled:
            logger.info("Outcome checker filled results for %s signals", filled)


outcome_checker = OutcomeChecker()
