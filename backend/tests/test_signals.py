"""
Тести визначення тренду та системи сигналів (Завдання 8-9, частина Завдання 25).
"""

import pytest

from app.analysis.risk import assess_risk
from app.analysis.signals import generate_signal, score_to_signal
from app.analysis.trend import detect_trend
from app.models.schemas import Candle


class TestTrend:
    """Правила з Завдання 8 — дослівно."""

    def test_bullish(self):
        # EMA 20 вище EMA 50, ціна вище EMA 20
        assert detect_trend(price=105, ema20=102, ema50=100) == "bullish"

    def test_bearish(self):
        # EMA 20 нижче EMA 50, ціна нижче EMA 20
        assert detect_trend(price=95, ema20=98, ema50=100) == "bearish"

    def test_neutral_mixed(self):
        # EMA 20 вище EMA 50, але ціна нижче EMA 20 -> нейтральний
        assert detect_trend(price=101, ema20=102, ema50=100) == "neutral"
        # EMA 20 нижче EMA 50, але ціна вище EMA 20 -> нейтральний
        assert detect_trend(price=99, ema20=98, ema50=100) == "neutral"


class TestScoreMapping:
    """Таблиця оцінювання з Завдання 9 — усі межі діапазонів."""

    @pytest.mark.parametrize(
        "score,expected",
        [
            (8, "Strong Buy"),
            (6, "Strong Buy"),
            (5, "Buy"),
            (3, "Buy"),
            (2, "Neutral"),
            (0, "Neutral"),
            (-2, "Neutral"),
            (-3, "Sell"),
            (-5, "Sell"),
            (-6, "Strong Sell"),
            (-8, "Strong Sell"),
        ],
    )
    def test_boundaries(self, score, expected):
        assert score_to_signal(score) == expected


def clean_candles(n: int = 100) -> list[Candle]:
    """
    Монотонно зростаючі свічки: не мають pivot-екстремумів, тому
    find_levels не знаходить рівнів і бали тестуються ізольовано.
    (Ідеально пласкі свічки не підходять: вони створюють рівні прямо на ціні.)
    """
    candles, price = [], 100.0
    for i in range(n):
        o = price
        c = o * 1.001
        candles.append(
            Candle(
                time=i * 60_000,
                open=o,
                high=c * 1.0001,
                low=o * 0.9999,
                close=c,
                volume=1000,
            )
        )
        price = c
    return candles


def base_indicators(**overrides) -> dict:
    """Нейтральна заготовка індикаторів; тестові кейси перекривають потрібні поля."""
    base = {
        "price": 100.0,
        "ema20": 100.0,
        "ema50": 100.0,
        "rsi": 55.0,
        "macd": 0.0,
        "macdSignal": 0.0,
        "volumeChangePct": 0.0,
    }
    base.update(overrides)
    return base


class TestSignalScoring:
    """Кожне бальне правило з Завдання 9 окремо."""

    def test_all_bullish_rules(self):
        # EMA20>EMA50 (+2), price>EMA20 (+1), RSI 50-70 (+1), MACD>signal (+2) = +6
        ind = base_indicators(price=106, ema20=105, ema50=100, rsi=60, macd=1.0, macdSignal=0.5)
        result = generate_signal(ind, clean_candles())
        assert result["score"] == 6
        assert result["signal"] == "Strong Buy"
        assert len(result["reasons"]) == 4

    def test_all_bearish_rules(self):
        # EMA20<EMA50 (-2), price<EMA20 (-1), RSI<50 (-1), MACD<signal (-2) = -6
        ind = base_indicators(price=94, ema20=95, ema50=100, rsi=40, macd=-1.0, macdSignal=-0.5)
        result = generate_signal(ind, clean_candles())
        assert result["score"] == -6
        assert result["signal"] == "Strong Sell"

    def test_neutral_when_everything_flat(self):
        # Усе рівне: тільки RSI 55 дає +1 -> Neutral
        result = generate_signal(base_indicators(), clean_candles())
        assert result["score"] == 1
        assert result["signal"] == "Neutral"

    def test_volume_bonus_on_rising_candle(self):
        candles = clean_candles()
        # Остання свічка росте
        candles[-1] = Candle(time=candles[-1].time, open=100, high=101, low=100, close=100.9, volume=2000)
        ind = base_indicators(volumeChangePct=50.0, rsi=55)
        result = generate_signal(ind, candles)
        # RSI +1, volume +1 = 2
        assert result["score"] == 2
        assert any("Volume increased" in r for r in result["reasons"])

    def test_volume_penalty_on_falling_candle(self):
        candles = clean_candles()
        candles[-1] = Candle(time=candles[-1].time, open=100, high=100, low=99, close=99.1, volume=2000)
        ind = base_indicators(volumeChangePct=50.0, rsi=55, price=99.1)
        result = generate_signal(ind, candles)
        assert any("Selling volume" in r for r in result["reasons"])

    def test_rsi_above_70_gives_no_bonus(self):
        ind = base_indicators(rsi=75)
        result = generate_signal(ind, clean_candles())
        assert result["score"] == 0  # перекупленість не додає балів

    def test_reasons_always_explain_score(self):
        ind = base_indicators(price=106, ema20=105, ema50=100, rsi=60, macd=1.0, macdSignal=0.5)
        result = generate_signal(ind, clean_candles())
        assert result["reasons"], "Сигнал завжди має пояснення"


class TestRisk:
    """Правила з Завдання 11."""

    def test_low(self):
        r = assess_risk(price=100, atr=0.5, last_candle_change_pct=0.1)
        assert r["riskLevel"] == "Low" and r["warning"] is None

    def test_medium(self):
        r = assess_risk(price=100, atr=1.5, last_candle_change_pct=0.5)
        assert r["riskLevel"] == "Medium"

    def test_high_by_atr(self):
        r = assess_risk(price=100, atr=3.0, last_candle_change_pct=0.5)
        assert r["riskLevel"] == "High"
        assert r["warning"] == "High volatility. The market may move rapidly."

    def test_high_by_sharp_move(self):
        # ATR низький, але остання свічка стрибнула на 5%
        r = assess_risk(price=100, atr=0.3, last_candle_change_pct=5.0)
        assert r["riskLevel"] == "High"
