import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAnalysis } from "../api";
import type { AnalysisResult, RiskLevel, Timeframe, TrendType } from "../types";
import CandleChart from "../components/CandleChart";
import SignalBadge from "../components/SignalBadge";
import BacktestPanel from "../components/BacktestPanel";
import OrderBook from "../components/OrderBook";
import TradeLevelsPanel from "../components/TradeLevelsPanel";
import SignalScale from "../components/SignalScale";
import { Card } from "../components/ui/Card";
import { formatUsd } from "../lib/format";

const ANALYSIS_TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h"]; // МВП з ТЗ (Завдання 32)
const REFRESH_MS = 60_000;

const TREND_LABEL: Record<TrendType, { text: string; cls: string }> = {
  bullish: { text: "Bullish", cls: "text-bull" },
  bearish: { text: "Bearish", cls: "text-bear" },
  neutral: { text: "Neutral", cls: "text-muted" },
};

const RISK_CLS: Record<RiskLevel, string> = {
  Low: "bg-bull/10 text-bull border-bull/20",
  Medium: "bg-accent/10 text-accent border-accent/30",
  High: "bg-bear/10 text-bear border-bear/20",
};

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function IndicatorTile({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: string;
}) {
  const statusCls =
    status === "bullish" || status === "oversold" || status === "rising"
      ? "text-bull"
      : status === "bearish" || status === "overbought" || status === "falling"
        ? "text-bear"
        : "text-muted";
  return (
    <div className="rounded-card border border-border bg-panel2 p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-sm font-medium text-ink">{value}</p>
      {status && <p className={`mt-0.5 text-xs ${statusCls}`}>{status.replace(/_/g, " ")}</p>}
    </div>
  );
}

export default function AnalyzePage() {
  const { symbol = "BTCUSDT" } = useParams();
  const sym = symbol.toUpperCase();

  const [interval, setInterval] = useState<Timeframe>("1h");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getAnalysis(sym, interval);
      setAnalysis(data);
      setError(null);
    } catch {
      setError("Market data is temporarily unavailable. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [sym, interval]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const trend = analysis ? TREND_LABEL[analysis.trend] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between border-b border-border/60 bg-base/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link to="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Back to markets
        </Link>
        <div className="flex gap-1 rounded-control border border-border bg-panel2 p-1">
          {ANALYSIS_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setInterval(tf)}
              className={`rounded-[0.375rem] px-3 py-1 font-mono text-xs transition-colors ${
                tf === interval ? "bg-accent font-semibold text-deep" : "text-muted hover:text-ink"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-card border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="rounded-card border border-border bg-panel p-8 text-sm text-muted shadow-card">
          Analyzing {sym.replace("USDT", "")}/USDT…
        </div>
      )}

      {analysis && (
        <>
          {/* Головна картка сигналу */}
          <Card className="mt-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  {sym.replace("USDT", "")}/USDT · {analysis.interval}
                </p>
                <p className="tabular mt-1 text-3xl font-bold text-ink sm:text-4xl">
                  {formatUsd(analysis.price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SignalBadge signal={analysis.signal} />
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${RISK_CLS[analysis.riskLevel]}`}
                >
                  Risk: {analysis.riskLevel}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SignalScale score={analysis.score} signal={analysis.signal} />
              <div className="text-sm">
                <span className="text-muted">Trend: </span>
                {trend && <span className={`font-medium ${trend.cls}`}>{trend.text}</span>}
                <span className="mx-2 text-border">·</span>
                <span className="text-muted">ATR: </span>
                <span className="tabular text-ink">{fmt(analysis.atrPct)}%</span>
              </div>
            </div>

            {analysis.riskWarning && (
              <p className="mt-4 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
                {analysis.riskWarning}
              </p>
            )}

            {/* Причини сигналу — Завдання 9: "сигнал має пояснення" */}
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted">Reasons</p>
              <ul className="space-y-1.5">
                {analysis.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {r}
                  </li>
                ))}
                {analysis.reasons.length === 0 && (
                  <li className="text-sm text-muted">No strong factors either way right now.</li>
                )}
              </ul>
            </div>

            <p className="mt-4 text-right text-xs text-muted">
              Updated {new Date(analysis.updatedAt).toLocaleTimeString()}
            </p>
          </Card>

          {/* Пропоновані рівні входу/TP/SL: Spot/Futures + повзунок плеча */}
          {analysis.tradeLevels && <TradeLevelsPanel levels={analysis.tradeLevels} />}

          {/* Графік + жива глибина ринку (bid/ask) поруч, як у біржовому терміналі */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <CandleChart symbol={sym} interval={interval} onIntervalChange={setInterval} />
            {/* На вузькому екрані ордербук згорнутий (див. OrderBook): 30 його
                рядків відсували індикатори й бек-тест далеко за межу видимого */}
            <OrderBook symbol={sym} />
          </div>

          {/* Індикатори */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <IndicatorTile
              label="RSI 14"
              value={fmt(analysis.indicators.rsi)}
              status={analysis.indicators.rsiStatus}
            />
            <IndicatorTile
              label="MACD"
              value={`${fmt(analysis.indicators.macd, 4)} / ${fmt(analysis.indicators.macdSignal, 4)}`}
              status={analysis.indicators.macdStatus}
            />
            <IndicatorTile
              label="EMA 20"
              value={fmt(analysis.indicators.ema20, analysis.price < 1 ? 6 : 2)}
              status={analysis.indicators.emaTrend}
            />
            <IndicatorTile
              label="EMA 50"
              value={fmt(analysis.indicators.ema50, analysis.price < 1 ? 6 : 2)}
            />
            <IndicatorTile
              label="Bollinger Bands"
              value={`${fmt(analysis.indicators.bbLower, 2)} – ${fmt(analysis.indicators.bbUpper, 2)}`}
              status={analysis.indicators.bbStatus}
            />
            <IndicatorTile label="ATR 14" value={fmt(analysis.indicators.atr, 4)} />
            <IndicatorTile
              label="Volume change"
              value={`${analysis.indicators.volumeChangePct > 0 ? "+" : ""}${fmt(analysis.indicators.volumeChangePct)}%`}
              status={analysis.indicators.volumeStatus}
            />
            <IndicatorTile
              label="Support / Resistance"
              value={`${fmt(analysis.support, 2)} / ${fmt(analysis.resistance, 2)}`}
            />
          </div>

          <div className="mt-6">
            <BacktestPanel symbol={sym} interval={interval} />
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Signals are analytical data, not guaranteed financial advice.
          </p>
        </>
      )}
    </div>
  );
}
