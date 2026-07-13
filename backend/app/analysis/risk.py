"""
Рівень ризику за волатильністю. Завдання 11.

ATR нормалізуємо до ціни (ATR%), щоб пороги працювали однаково
для BTC за $60 000 і PEPE за $0.00001:
    ATR% < 1.0  -> Low
    ATR% < 2.5  -> Medium
    інакше      -> High

Додатково: різка зміна ціни на останній свічці (>3%) одразу дає High.
"""

RISK_WARNING = "High volatility. The market may move rapidly."


def assess_risk(price: float, atr: float, last_candle_change_pct: float) -> dict:
    atr_pct = (atr / price * 100) if price > 0 else 0.0

    if abs(last_candle_change_pct) > 3.0 or atr_pct >= 2.5:
        level = "High"
    elif atr_pct >= 1.0:
        level = "Medium"
    else:
        level = "Low"

    return {
        "riskLevel": level,
        "atrPct": round(atr_pct, 2),
        "warning": RISK_WARNING if level == "High" else None,
    }
