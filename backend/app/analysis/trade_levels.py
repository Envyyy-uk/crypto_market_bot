"""
Пропоновані рівні входу/стопу/тейку (TP/SL) — доповнення до сигналу.

Важливо: це НЕ передбачення "ідеальної" точки входу — такого не існує,
бо це вимагало б знання майбутньої ціни. Натомість — прозора евристика:
    - вхід: поточна ціна (як за ринковим ордером)
    - стоп-лосс: ATR-волатильність АБО найближчий рівень підтримки/опору
      (якщо він реалістично близько), що дає менш довільний стоп
    - тейк-профіт: співвідношення ризик/прибуток 1:2 АБО найближчий
      протилежний рівень, якщо він дає приблизно таку саму ціль

Рахуємо тільки для напрямлених сигналів (Buy/Sell і їх Strong-варіанти) —
для Neutral чіткого напрямку немає, тож і рівнів не пропонуємо.
"""

ATR_STOP_MULTIPLIER = 1.5
RISK_REWARD_RATIO = 2.0
LEVEL_BUFFER_PCT = 0.2  # невеликий відступ від рівня, щоб стоп не "зняло по фітилю"
MIN_RISK_REWARD = 1.2  # протилежний рівень ігнорується як ціль, якщо R:R гірший за це

TRADE_LEVELS_NOTE = (
    "Heuristic based on ATR volatility and pivot support/resistance levels — "
    "not a guaranteed price or financial advice. Always confirm before trading."
)


def compute_trade_levels(
    signal: str,
    price: float,
    atr: float,
    support: float | None,
    resistance: float | None,
) -> dict | None:
    if signal not in ("Strong Buy", "Buy", "Sell", "Strong Sell"):
        return None
    if price <= 0 or atr <= 0:
        return None

    is_long = signal in ("Strong Buy", "Buy")
    base_stop_distance = atr * ATR_STOP_MULTIPLIER

    if is_long:
        atr_stop = price - base_stop_distance
        if support is not None and 0 < price - support < base_stop_distance * 2:
            stop_loss = support * (1 - LEVEL_BUFFER_PCT / 100)
        else:
            stop_loss = atr_stop
        stop_distance = price - stop_loss
        if stop_distance <= 0:
            return None

        target = price + stop_distance * RISK_REWARD_RATIO
        if (
            resistance is not None
            and price < resistance < target * 1.15
            and (resistance - price) / stop_distance >= MIN_RISK_REWARD
        ):
            take_profit = resistance
        else:
            take_profit = target
    else:
        atr_stop = price + base_stop_distance
        if resistance is not None and 0 < resistance - price < base_stop_distance * 2:
            stop_loss = resistance * (1 + LEVEL_BUFFER_PCT / 100)
        else:
            stop_loss = atr_stop
        stop_distance = stop_loss - price
        if stop_distance <= 0:
            return None

        target = price - stop_distance * RISK_REWARD_RATIO
        if (
            support is not None
            and target * 0.85 < support < price
            and (price - support) / stop_distance >= MIN_RISK_REWARD
        ):
            take_profit = support
        else:
            take_profit = target

    reward_distance = abs(take_profit - price)
    risk_reward = round(reward_distance / stop_distance, 2)

    return {
        "direction": "long" if is_long else "short",
        "entry": round(price, 8),
        "stopLoss": round(stop_loss, 8),
        "takeProfit": round(take_profit, 8),
        "riskRewardRatio": risk_reward,
        "note": TRADE_LEVELS_NOTE,
    }
