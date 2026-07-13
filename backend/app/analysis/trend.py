"""
Визначення тренду. Завдання 8.

Правила з ТЗ:
    EMA 20 вище EMA 50 і ціна вище EMA 20  -> висхідний (bullish)
    EMA 20 нижче EMA 50 і ціна нижче EMA 20 -> низхідний (bearish)
    інакше                                   -> нейтральний (neutral)
"""


def detect_trend(price: float, ema20: float, ema50: float) -> str:
    if ema20 > ema50 and price > ema20:
        return "bullish"
    if ema20 < ema50 and price < ema20:
        return "bearish"
    return "neutral"
