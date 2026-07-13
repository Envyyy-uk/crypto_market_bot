"""
Тести перевірки результатів сигналів (Завдання 21, частина Завдання 25).
"""

from app.models.schemas import Candle
from app.services.outcome_checker import CANDLE_MS, extremes, price_at


def candles_5m(start_ms: int, closes: list[float]) -> list[Candle]:
    """Серія 5m-свічок; high/low симетрично навколо close."""
    return [
        Candle(
            time=start_ms + i * CANDLE_MS,
            open=c,
            high=c * 1.01,
            low=c * 0.99,
            close=c,
            volume=100,
        )
        for i, c in enumerate(closes)
    ]


class TestPriceAt:
    def test_exact_candle_open(self):
        cs = candles_5m(0, [100, 101, 102])
        assert price_at(cs, 0) == 100
        assert price_at(cs, CANDLE_MS) == 101

    def test_inside_candle_window(self):
        cs = candles_5m(0, [100, 101, 102])
        # Середина другої свічки належить їй
        assert price_at(cs, CANDLE_MS + CANDLE_MS // 2) == 101

    def test_target_outside_range_returns_none(self):
        cs = candles_5m(0, [100, 101])
        assert price_at(cs, 10 * CANDLE_MS) is None
        assert price_at(cs, -1) is None


class TestExtremes:
    def test_rise_and_drop(self):
        # Вхід 100; у вікні max close 110 (high 111.1), min close 95 (low 94.05)
        cs = candles_5m(0, [100, 110, 95, 105])
        result = extremes(cs, 0, 4 * CANDLE_MS, entry=100)
        assert result is not None
        rise, drop = result
        assert rise == 11.1
        assert drop == -5.95

    def test_window_boundaries_are_half_open(self):
        cs = candles_5m(0, [100, 200, 300])
        # Вікно [0, 2*CANDLE_MS) не включає третю свічку (300)
        result = extremes(cs, 0, 2 * CANDLE_MS, entry=100)
        rise, _ = result
        assert rise == 102.0  # high другої свічки = 202 -> +102%

    def test_empty_window_returns_none(self):
        cs = candles_5m(0, [100])
        assert extremes(cs, 10 * CANDLE_MS, 20 * CANDLE_MS, entry=100) is None

    def test_bad_entry_returns_none(self):
        cs = candles_5m(0, [100])
        assert extremes(cs, 0, CANDLE_MS, entry=0) is None
