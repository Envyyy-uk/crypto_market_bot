"""
Тести бек-тестування (Завдання 22, частина Завдання 25).
"""

import random

import pytest

from app.backtesting.backtest import compute_metrics, run_backtest
from app.models.schemas import Candle


class TestMetrics:
    def test_known_series(self):
        m = compute_metrics([2.0, -1.0, -1.0, 3.0, -2.0])
        assert m["totalSignals"] == 5
        assert m["successfulSignals"] == 2
        assert m["winRate"] == 40.0
        assert m["averageResultPct"] == 0.2
        assert m["bestTradePct"] == 3.0
        assert m["worstTradePct"] == -2.0
        assert m["profitFactor"] == 1.25  # (2+3)/(1+1+2)
        assert m["maxLosingStreak"] == 2

    def test_drawdown_compounds(self):
        m = compute_metrics([2.0, -1.0, -1.0, 3.0, -2.0])
        # Еталон: компаундимо вручну
        eq, peak, dd = 1.0, 1.0, 0.0
        for r in [2, -1, -1, 3, -2]:
            eq *= 1 + r / 100
            peak = max(peak, eq)
            dd = max(dd, (peak - eq) / peak)
        assert m["maxDrawdownPct"] == round(-dd * 100, 2)

    def test_empty(self):
        m = compute_metrics([])
        assert m["totalSignals"] == 0
        assert m["winRate"] is None

    def test_only_wins_pf_capped(self):
        m = compute_metrics([1.0, 2.0])
        assert m["profitFactor"] == 999.0
        assert m["maxLosingStreak"] == 0


def alternating_trend_candles(n: int = 400) -> list[Candle]:
    """Фази росту/падіння по 50 свічок — гарантовано породжують сигнали."""
    random.seed(1)
    candles, price = [], 100.0
    for i in range(n):
        drift = 0.004 if (i // 50) % 2 == 0 else -0.004
        o = price
        c = o * (1 + drift + random.uniform(-0.001, 0.001))
        candles.append(
            Candle(
                time=i * 3_600_000,
                open=o,
                high=max(o, c) * 1.002,
                low=min(o, c) * 0.998,
                close=c,
                volume=random.uniform(900, 1100),
            )
        )
        price = c
    return candles


class TestRunBacktest:
    def test_produces_trades_on_trend_flips(self):
        r = run_backtest(alternating_trend_candles(), horizon=6)
        assert r["totalSignals"] > 0
        assert 0 <= r["winRate"] <= 100
        assert r["candlesTested"] == 400 - 60 - 6
        assert len(r["trades"]) <= 50

    def test_not_enough_candles(self):
        with pytest.raises(ValueError):
            run_backtest(alternating_trend_candles(50), horizon=6)
