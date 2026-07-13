import { useState } from "react";
import type { Timeframe } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

interface BacktestResult {
  totalSignals: number;
  successfulSignals: number;
  winRate: number | null;
  averageResultPct: number | null;
  bestTradePct: number | null;
  worstTradePct: number | null;
  profitFactor: number | null;
  maxLosingStreak: number;
  maxDrawdownPct: number | null;
  horizonCandles: number;
  candlesTested: number;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="rounded-xl border border-border bg-panel2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`tabular mt-1 text-sm font-medium ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

export default function BacktestPanel({
  symbol,
  interval,
}: {
  symbol: string;
  interval: Timeframe;
}) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/backtest/${symbol}?interval=${interval}&horizon=12`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? "Backtest failed. Please try again.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const fmtPct = (v: number | null, signed = true) =>
    v === null ? "—" : `${signed && v > 0 ? "+" : ""}${v}%`;

  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-medium text-ink">Strategy backtest</h3>
          <p className="mt-0.5 text-xs text-muted">
            Replays this exact signal strategy over the last 1000 {interval} candles.
            Result horizon: 12 candles.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Running…" : result ? "Run again" : "Run backtest"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Signals" value={`${result.totalSignals}`} />
            <Metric
              label="Win rate"
              value={result.winRate !== null ? `${result.winRate}%` : "—"}
              tone={(result.winRate ?? 0) >= 50 ? "bull" : "bear"}
            />
            <Metric
              label="Avg result"
              value={fmtPct(result.averageResultPct)}
              tone={(result.averageResultPct ?? 0) >= 0 ? "bull" : "bear"}
            />
            <Metric
              label="Profit factor"
              value={result.profitFactor !== null ? `${result.profitFactor}` : "—"}
              tone={(result.profitFactor ?? 0) >= 1 ? "bull" : "bear"}
            />
            <Metric label="Max drawdown" value={fmtPct(result.maxDrawdownPct, false)} tone="bear" />
            <Metric label="Best trade" value={fmtPct(result.bestTradePct)} tone="bull" />
            <Metric label="Worst trade" value={fmtPct(result.worstTradePct)} tone="bear" />
            <Metric label="Max losing streak" value={`${result.maxLosingStreak}`} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Tested on {result.candlesTested} candles. Past performance does not guarantee
            future results.
          </p>
        </>
      )}
    </div>
  );
}
