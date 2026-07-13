"""
Бек-тестування стратегії. Завдання 22.

Ключовий принцип: тестуємо ТУ САМУ стратегію, що працює наживо —
використовуємо той самий generate_signal() з app/analysis/signals.py,
лише індикатори попередньо розраховані векторно для швидкості.

Хід тесту:
  1. Беремо історичні свічки (напр., 1000 x 1h).
  2. Ідемо по свічках; коли тип сигналу ЗМІНИВСЯ і він не Neutral —
     фіксуємо "угоду": вхід за close, оцінка через `horizon` свічок.
  3. Результат угоди — % зміни в напрямку сигналу
     (для Sell зростання ціни = збиток).

Метрики (усі з ТЗ):
  кількість сигналів, успішні, win rate, середній результат,
  макс. просадка (equity), найкраща/найгірша угода,
  profit factor, макс. серія збиткових.
"""

from dataclasses import dataclass

from app.analysis.indicators import ema, macd, rsi, candles_to_df, MIN_CANDLES
from app.analysis.signals import generate_signal
from app.models.schemas import Candle

WARMUP = MIN_CANDLES  # перші свічки лише "розігрівають" індикатори


@dataclass
class Trade:
    index: int          # індекс свічки входу
    time: int           # час входу (unix ms)
    signal: str         # Buy / Strong Buy / Sell / Strong Sell
    entry: float
    exit: float
    result_pct: float   # у напрямку сигналу


# ---------- метрики (чиста функція — легко тестувати) ----------

def compute_metrics(results: list[float]) -> dict:
    """Метрики за списком результатів угод (% у напрямку сигналу)."""
    total = len(results)
    if total == 0:
        return {
            "totalSignals": 0,
            "successfulSignals": 0,
            "winRate": None,
            "averageResultPct": None,
            "bestTradePct": None,
            "worstTradePct": None,
            "profitFactor": None,
            "maxLosingStreak": 0,
            "maxDrawdownPct": None,
        }

    wins = [r for r in results if r > 0]
    losses = [r for r in results if r < 0]

    gross_profit = sum(wins)
    gross_loss = -sum(losses)
    if gross_loss > 0:
        profit_factor = round(gross_profit / gross_loss, 2)
    else:
        profit_factor = None if gross_profit == 0 else float("inf")

    # Макс. серія збиткових поспіль
    max_streak = streak = 0
    for r in results:
        if r < 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    # Просадка кривої капіталу (компаундинг результатів)
    equity = 1.0
    peak = 1.0
    max_dd = 0.0
    for r in results:
        equity *= 1 + r / 100
        peak = max(peak, equity)
        max_dd = max(max_dd, (peak - equity) / peak)

    return {
        "totalSignals": total,
        "successfulSignals": len(wins),
        "winRate": round(len(wins) / total * 100, 1),
        "averageResultPct": round(sum(results) / total, 2),
        "bestTradePct": round(max(results), 2),
        "worstTradePct": round(min(results), 2),
        "profitFactor": profit_factor if profit_factor != float("inf") else 999.0,
        "maxLosingStreak": max_streak,
        "maxDrawdownPct": round(-max_dd * 100, 2),
    }


# ---------- сам бек-тест ----------

def run_backtest(candles: list[Candle], horizon: int = 12) -> dict:
    """
    horizon — через скільки свічок оцінюється результат
    (12 x 1h = пів доби; 16 x 15m = 4 години).
    """
    if len(candles) < WARMUP + horizon + 10:
        raise ValueError(
            f"Not enough candles for a backtest: need at least {WARMUP + horizon + 10}, got {len(candles)}"
        )

    df = candles_to_df(candles)
    close = df["close"]
    volume = df["volume"]

    # Векторний розрахунок один раз на весь ряд — той самий код, що в indicators.py
    ema20_s = ema(close, 20)
    ema50_s = ema(close, 50)
    rsi_s = rsi(close)
    macd_line, signal_line, _ = macd(close)
    vol_avg = volume.rolling(20).mean().shift(1)  # середнє за ПОПЕРЕДНІ 20 свічок

    trades: list[Trade] = []
    prev_signal = "Neutral"

    last_eval = len(candles) - horizon
    for i in range(WARMUP, last_eval):
        va = vol_avg.iloc[i]
        vol_change = (volume.iloc[i] / va - 1) * 100 if va and va > 0 else 0.0

        indicators = {
            "price": float(close.iloc[i]),
            "ema20": float(ema20_s.iloc[i]),
            "ema50": float(ema50_s.iloc[i]),
            "rsi": float(rsi_s.iloc[i]),
            "macd": float(macd_line.iloc[i]),
            "macdSignal": float(signal_line.iloc[i]),
            "volumeChangePct": float(vol_change),
        }

        sig = generate_signal(indicators, candles[: i + 1])
        current = sig["signal"]

        if current != prev_signal and current != "Neutral":
            entry = float(close.iloc[i])
            exit_price = float(close.iloc[i + horizon])
            raw_pct = (exit_price / entry - 1) * 100
            is_buy = current in ("Buy", "Strong Buy")
            result = raw_pct if is_buy else -raw_pct
            trades.append(
                Trade(
                    index=i,
                    time=int(df["time"].iloc[i]),
                    signal=current,
                    entry=entry,
                    exit=exit_price,
                    result_pct=round(result, 2),
                )
            )

        prev_signal = current

    metrics = compute_metrics([t.result_pct for t in trades])
    return {
        **metrics,
        "horizonCandles": horizon,
        "candlesTested": last_eval - WARMUP,
        "trades": [
            {
                "time": t.time,
                "signal": t.signal,
                "entry": t.entry,
                "exit": t.exit,
                "resultPct": t.result_pct,
            }
            for t in trades[-50:]  # останні 50 угод для перегляду
        ],
    }
