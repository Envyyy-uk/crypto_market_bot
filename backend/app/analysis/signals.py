"""
Система сигналів із бальною оцінкою. Завдання 9.

Бали (точно за ТЗ):
    Позитивні:
        EMA 20 вище EMA 50 .......................... +2
        Ціна вище EMA 20 ............................. +1
        RSI від 50 до 70 ............................. +1
        MACD вище signal line ........................ +2
        Обсяг зріс більше ніж на 20% (свічка росту) .. +1
        Ціна біля рівня підтримки .................... +1
    Негативні:
        EMA 20 нижче EMA 50 .......................... -2
        Ціна нижче EMA 20 ............................. -1
        RSI нижче 50 .................................. -1
        MACD нижче signal line ........................ -2
        Обсяг продажів зріс більше ніж на 20% ......... -1
        Ціна біля рівня опору ......................... -1

Оцінювання:
    +6..+8  Strong Buy
    +3..+5  Buy
    -2..+2  Neutral
    -5..-3  Sell
    -8..-6  Strong Sell
"""

from app.models.schemas import Candle

# Ціна вважається "біля" рівня, якщо відстань до нього < 1.5%
LEVEL_PROXIMITY_PCT = 1.5
# Скільки останніх свічок дивимось для пошуку рівнів
LEVEL_LOOKBACK = 50
# Скільки свічок ліворуч/праворуч мають бути нижчі/вищі, щоб вважати точку екстремумом
PIVOT_WINDOW = 3


def find_levels(candles: list[Candle]) -> dict:
    """
    Прості рівні підтримки/опору через локальні екстремуми (pivot points):
    підтримка — локальні мінімуми low, опір — локальні максимуми high.
    Повертаємо найближчу підтримку нижче ціни і найближчий опір вище ціни.
    """
    recent = candles[-LEVEL_LOOKBACK:]
    price = recent[-1].close

    supports: list[float] = []
    resistances: list[float] = []

    for i in range(PIVOT_WINDOW, len(recent) - PIVOT_WINDOW):
        window_before = recent[i - PIVOT_WINDOW : i]
        window_after = recent[i + 1 : i + 1 + PIVOT_WINDOW]

        low_i = recent[i].low
        if all(low_i <= c.low for c in window_before + window_after):
            supports.append(low_i)

        high_i = recent[i].high
        if all(high_i >= c.high for c in window_before + window_after):
            resistances.append(high_i)

    nearest_support = max((s for s in supports if s <= price), default=None)
    nearest_resistance = min((r for r in resistances if r >= price), default=None)

    return {"support": nearest_support, "resistance": nearest_resistance}


def _near_level(price: float, level: float | None) -> bool:
    if level is None or price <= 0:
        return False
    return abs(price - level) / price * 100 <= LEVEL_PROXIMITY_PCT


def score_to_signal(score: int) -> str:
    if score >= 6:
        return "Strong Buy"
    if score >= 3:
        return "Buy"
    if score >= -2:
        return "Neutral"
    if score >= -5:
        return "Sell"
    return "Strong Sell"


def generate_signal(indicators: dict, candles: list[Candle]) -> dict:
    """
    Створити сигнал за значеннями індикаторів (з compute_indicators)
    і свічками (для рівнів підтримки/опору та напрямку останньої свічки).

    Повертає: тип сигналу, бал, максимум можливого, і список причин (Завдання 9:
    "Бот створює сигнал і пояснює причини його появи").
    """
    score = 0
    reasons: list[str] = []

    price = indicators["price"]
    ema20 = indicators["ema20"]
    ema50 = indicators["ema50"]
    rsi = indicators["rsi"]
    macd_val = indicators["macd"]
    macd_signal = indicators["macdSignal"]
    volume_change = indicators["volumeChangePct"]

    last = candles[-1]
    last_candle_up = last.close >= last.open

    levels = find_levels(candles)
    near_support = _near_level(price, levels["support"])
    near_resistance = _near_level(price, levels["resistance"])

    # ---- EMA-перетин: +2 / -2
    if ema20 > ema50:
        score += 2
        reasons.append("EMA 20 is above EMA 50")
    elif ema20 < ema50:
        score -= 2
        reasons.append("EMA 20 is below EMA 50")

    # ---- Ціна відносно EMA 20: +1 / -1
    if price > ema20:
        score += 1
        reasons.append("Price is above EMA 20")
    elif price < ema20:
        score -= 1
        reasons.append("Price is below EMA 20")

    # ---- RSI: +1 якщо 50-70, -1 якщо нижче 50
    if 50 <= rsi <= 70:
        score += 1
        reasons.append(f"RSI is {rsi:.0f} (healthy bullish zone)")
    elif rsi < 50:
        score -= 1
        reasons.append(f"RSI is {rsi:.0f} (below 50)")
    # RSI > 70 не дає балів — перекупленість не підсилює купівлю

    # ---- MACD проти signal line: +2 / -2
    if macd_val > macd_signal:
        score += 2
        reasons.append("MACD shows bullish momentum")
    elif macd_val < macd_signal:
        score -= 2
        reasons.append("MACD shows bearish momentum")

    # ---- Обсяг: +1 якщо зростання обсягу на свічці росту, -1 на свічці падіння
    if volume_change > 20:
        if last_candle_up:
            score += 1
            reasons.append(f"Volume increased by {volume_change:.0f}% on a rising candle")
        else:
            score -= 1
            reasons.append(f"Selling volume increased by {volume_change:.0f}%")

    # ---- Рівні: +1 біля підтримки, -1 біля опору
    if near_support:
        score += 1
        reasons.append("Price is near a support level")
    if near_resistance:
        score -= 1
        reasons.append("Price is near a resistance level")

    return {
        "signal": score_to_signal(score),
        "score": score,
        "maxScore": 8,
        "reasons": reasons,
        "support": levels["support"],
        "resistance": levels["resistance"],
    }
