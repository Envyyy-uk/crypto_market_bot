"""
Розрахунок технічних індикаторів. Завдання 7.

Реалізовано на pandas без сторонніх TA-бібліотек — формули стандартні,
а так менше залежностей і легше тестувати (Завдання 25).

Для кожного індикатора повертаємо: поточне значення, попереднє значення
і текстову інтерпретацію — як вимагає ТЗ.
"""

import pandas as pd

from app.models.schemas import Candle

# Мінімум свічок, щоб усі індикатори мали сенс (найдовше вікно — SMA/EMA 50)
MIN_CANDLES = 60


def candles_to_df(candles: list[Candle]) -> pd.DataFrame:
    df = pd.DataFrame([c.model_dump() for c in candles])
    df = df.sort_values("time").reset_index(drop=True)
    return df


# ---------- базові розрахунки ----------

def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    # Wilder's smoothing — стандарт для RSI
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    macd_line = ema(series, fast) - ema(series, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(series: pd.Series, period: int = 20, std_mult: float = 2.0):
    middle = sma(series, period)
    std = series.rolling(window=period).std()
    upper = middle + std_mult * std
    lower = middle - std_mult * std
    return upper, middle, lower


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


# ---------- інтерпретації ----------

def interpret_rsi(value: float) -> str:
    if value >= 70:
        return "overbought"
    if value <= 30:
        return "oversold"
    return "neutral"


def interpret_ema_trend(ema20: float, ema50: float) -> str:
    if ema20 > ema50:
        return "bullish"
    if ema20 < ema50:
        return "bearish"
    return "neutral"


def interpret_macd(macd_val: float, signal_val: float) -> str:
    if macd_val > signal_val:
        return "bullish"
    if macd_val < signal_val:
        return "bearish"
    return "neutral"


def interpret_bollinger(price: float, upper: float, lower: float) -> str:
    if price >= upper:
        return "above_upper_band"
    if price <= lower:
        return "below_lower_band"
    return "inside_bands"


def interpret_volume_change(pct: float) -> str:
    if pct > 20:
        return "rising"
    if pct < -20:
        return "falling"
    return "stable"


# ---------- головна функція ----------

def _pair(series: pd.Series, digits: int = 2) -> tuple[float, float]:
    """Останнє та передостаннє значення, округлені."""
    return round(float(series.iloc[-1]), digits), round(float(series.iloc[-2]), digits)


def compute_indicators(candles: list[Candle]) -> dict:
    """
    Розрахувати всі індикатори за списком свічок.
    Кидає ValueError, якщо свічок недостатньо (Завдання 23 — обробка помилок).
    """
    if len(candles) < MIN_CANDLES:
        raise ValueError(
            f"Not enough candles for analysis: need at least {MIN_CANDLES}, got {len(candles)}"
        )

    df = candles_to_df(candles)
    close = df["close"]

    price = float(close.iloc[-1])
    price_digits = 6 if price < 1 else 2

    sma20_now, sma20_prev = _pair(sma(close, 20), price_digits)
    sma50_now, sma50_prev = _pair(sma(close, 50), price_digits)
    ema20_series = ema(close, 20)
    ema50_series = ema(close, 50)
    ema20_now, ema20_prev = _pair(ema20_series, price_digits)
    ema50_now, ema50_prev = _pair(ema50_series, price_digits)

    rsi_series = rsi(close)
    rsi_now, rsi_prev = _pair(rsi_series)

    macd_line, signal_line, histogram = macd(close)
    macd_now, macd_prev = _pair(macd_line, price_digits)
    signal_now, signal_prev = _pair(signal_line, price_digits)
    hist_now, hist_prev = _pair(histogram, price_digits)

    bb_upper, bb_middle, bb_lower = bollinger_bands(close)
    bb_upper_now, bb_upper_prev = _pair(bb_upper, price_digits)
    bb_middle_now, bb_middle_prev = _pair(bb_middle, price_digits)
    bb_lower_now, bb_lower_prev = _pair(bb_lower, price_digits)

    atr_series = atr(df)
    atr_now, atr_prev = _pair(atr_series, price_digits)

    # Зміна обсягу: остання свічка проти середнього за попередні 20
    vol_avg = float(df["volume"].iloc[-21:-1].mean())
    vol_last = float(df["volume"].iloc[-1])
    volume_change_pct = round((vol_last / vol_avg - 1) * 100, 2) if vol_avg > 0 else 0.0

    return {
        "price": round(price, price_digits),
        "sma20": sma20_now,
        "sma20Prev": sma20_prev,
        "sma50": sma50_now,
        "sma50Prev": sma50_prev,
        "ema20": ema20_now,
        "ema20Prev": ema20_prev,
        "ema50": ema50_now,
        "ema50Prev": ema50_prev,
        "emaTrend": interpret_ema_trend(ema20_now, ema50_now),
        "rsi": rsi_now,
        "rsiPrev": rsi_prev,
        "rsiStatus": interpret_rsi(rsi_now),
        "macd": macd_now,
        "macdPrev": macd_prev,
        "macdSignal": signal_now,
        "macdSignalPrev": signal_prev,
        "macdHistogram": hist_now,
        "macdHistogramPrev": hist_prev,
        "macdStatus": interpret_macd(macd_now, signal_now),
        "bbUpper": bb_upper_now,
        "bbUpperPrev": bb_upper_prev,
        "bbMiddle": bb_middle_now,
        "bbMiddlePrev": bb_middle_prev,
        "bbLower": bb_lower_now,
        "bbLowerPrev": bb_lower_prev,
        "bbStatus": interpret_bollinger(price, bb_upper_now, bb_lower_now),
        "atr": atr_now,
        "atrPrev": atr_prev,
        "volumeChangePct": volume_change_pct,
        "volumeStatus": interpret_volume_change(volume_change_pct),
    }
