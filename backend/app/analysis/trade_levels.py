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

# --- Плече для ф'ючерсів/перпетуалів ---
# Консервативний орієнтир maintenance margin — реальний % залежить від біржі й
# рівня плеча (у Bybit/Binance він росте зі збільшенням позиції), тому свідомо
# беремо з запасом, а не мінімальне значення для великих пар типу BTC.
MAINTENANCE_MARGIN_RATE = 0.01
# Ліквідація має бути ЗАДОВГО за стоп-лоссом, а не впритул до нього — інакше
# при різкому русі ціни (проковзування, гепи) біржа ліквідує позицію раніше,
# ніж встигне спрацювати стоп, і сам стоп стає марним.
LIQUIDATION_SAFETY_FACTOR = 1.3
MAX_LEVERAGE_CEILING = 20.0
MIN_LEVERAGE = 1.0

LEVERAGE_NOTE = (
    "Approximate — actual liquidation price depends on the exchange's maintenance "
    "margin tiers, fees, and funding rate. Assumes isolated margin and keeps a "
    "safety buffer so the stop-loss triggers before liquidation, not at the same time."
)


def _liquidation_price(entry: float, leverage: float, direction: str) -> float:
    if direction == "long":
        return entry * (1 - 1 / leverage + MAINTENANCE_MARGIN_RATE)
    return entry * (1 + 1 / leverage - MAINTENANCE_MARGIN_RATE)


def compute_max_safe_leverage(entry: float, stop_loss: float, direction: str) -> dict | None:
    """
    Максимальне плече, за якого стоп-лосс (з запасом) спрацює РАНІШЕ за
    примусову ліквідацію біржею. Це не "рекомендоване" плече в сенсі
    прибутковості — лише стеля, вище якої сам стоп-лосс втрачає сенс.
    """
    stop_distance = abs(entry - stop_loss)
    if stop_distance <= 0 or entry <= 0:
        return None

    # 1/L >= stop_distance*SAFETY/entry + MMR  =>  L <= 1 / (...)
    required = stop_distance * LIQUIDATION_SAFETY_FACTOR / entry + MAINTENANCE_MARGIN_RATE
    max_leverage = MAX_LEVERAGE_CEILING if required <= 0 else min(MAX_LEVERAGE_CEILING, 1 / required)

    warning = None
    if max_leverage < MIN_LEVERAGE:
        max_leverage = MIN_LEVERAGE
        warning = (
            "Volatility is too high relative to this stop-loss for safe leveraged "
            "trading — even 1x risks liquidation before the stop triggers. "
            "Consider spot only, or a wider stop."
        )

    max_leverage = round(max_leverage, 1)
    return {
        "maxSafeLeverage": max_leverage,
        "liquidationPrice": round(_liquidation_price(entry, max_leverage, direction), 8),
        # Щоб фронтенд міг перераховувати ліквідацію для ДОВІЛЬНОГО плеча
        # (повзунок) тією самою формулою, а не дублювати константу.
        "maintenanceMarginRate": MAINTENANCE_MARGIN_RATE,
        "maxLeverageCeiling": MAX_LEVERAGE_CEILING,
        "warning": warning,
        "note": LEVERAGE_NOTE,
    }


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
    direction = "long" if is_long else "short"

    return {
        "direction": direction,
        "entry": round(price, 8),
        "stopLoss": round(stop_loss, 8),
        "takeProfit": round(take_profit, 8),
        "riskRewardRatio": risk_reward,
        "note": TRADE_LEVELS_NOTE,
        "leverage": compute_max_safe_leverage(price, stop_loss, direction),
    }
