"""
Тести розрахунку індикаторів (частина Завдання 25).

Запуск:
    cd backend
    pytest tests/ -v
"""

import random

import pandas as pd
import pytest

from app.analysis.indicators import (
    MIN_CANDLES,
    compute_indicators,
    ema,
    rsi,
    sma,
)
from app.models.schemas import Candle


def make_trend_candles(rate: float, n: int = 120) -> list[Candle]:
    """Детермінований тренд із постійною відсотковою зміною."""
    candles, price = [], 100.0
    for i in range(n):
        o = price
        c = o * (1 + rate)
        candles.append(
            Candle(
                time=i * 60_000,
                open=o,
                high=max(o, c) * 1.001,
                low=min(o, c) * 0.999,
                close=c,
                volume=1000,
            )
        )
        price = c
    return candles


def rsi_wilder_strict(closes: list[float], period: int = 14) -> float:
    """Еталонна Wilder-реалізація RSI для звірки."""
    deltas = [closes[i + 1] - closes[i] for i in range(len(closes) - 1)]
    gains = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]
    ag = sum(gains[:period]) / period
    al = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        ag = (ag * (period - 1) + gains[i]) / period
        al = (al * (period - 1) + losses[i]) / period
    if al == 0:
        return 100.0
    return 100 - 100 / (1 + ag / al)


class TestBasicMath:
    def test_sma_exact(self):
        s = pd.Series([1, 2, 3, 4, 5], dtype=float)
        assert sma(s, 5).iloc[-1] == 3.0

    def test_ema_exact(self):
        s = pd.Series([1, 2, 3, 4, 5], dtype=float)
        assert abs(ema(s, 5).iloc[-1] - 3.3951) < 0.01

    def test_rsi_matches_wilder_reference(self):
        """На 200 точках наш RSI має збігатися зі строгим Wilder до 0.05."""
        random.seed(7)
        closes = [100.0]
        for _ in range(199):
            closes.append(closes[-1] * (1 + random.uniform(-0.01, 0.011)))
        mine = float(rsi(pd.Series(closes)).iloc[-1])
        strict = rsi_wilder_strict(closes)
        assert abs(mine - strict) < 0.05

    def test_rsi_bounds(self):
        up = compute_indicators(make_trend_candles(+0.004))
        down = compute_indicators(make_trend_candles(-0.004))
        assert up["rsi"] == 100.0  # жодного спадного руху
        assert down["rsi"] == 0.0  # жодного висхідного руху


class TestIndicatorSemantics:
    def test_uptrend_is_bullish(self):
        result = compute_indicators(make_trend_candles(+0.004))
        assert result["emaTrend"] == "bullish"
        assert result["macd"] > 0
        assert result["rsiStatus"] == "overbought"

    def test_downtrend_is_bearish(self):
        result = compute_indicators(make_trend_candles(-0.004))
        assert result["emaTrend"] == "bearish"
        assert result["macd"] < 0
        assert result["rsiStatus"] == "oversold"

    def test_bollinger_band_order(self):
        result = compute_indicators(make_trend_candles(+0.002))
        assert result["bbLower"] < result["bbMiddle"] < result["bbUpper"]

    def test_atr_positive(self):
        result = compute_indicators(make_trend_candles(+0.002))
        assert result["atr"] > 0

    def test_returns_current_and_previous(self):
        result = compute_indicators(make_trend_candles(+0.002))
        for key in ["ema20", "ema50", "rsi", "macd", "atr"]:
            assert f"{key}Prev" in result


class TestErrorHandling:
    def test_not_enough_candles_raises(self):
        with pytest.raises(ValueError):
            compute_indicators(make_trend_candles(0.001, n=MIN_CANDLES - 1))
