import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSignals, getSignalStats, type SignalRecord, type SignalStats } from "../api";
import SignalBadge from "../components/SignalBadge";
import type { SignalType } from "../types";

const SYMBOLS = ["", "BTCUSDT", "ETHUSDT", "SOLUSDT"];
const SIGNAL_TYPES = ["", "Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"];
const TIMEFRAMES = ["", "15m", "1h", "4h"];

const selectCls =
  "rounded-lg border border-border bg-panel2 px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-amber";

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 2 });
}

/** Результат після сигналу: % зміни ціни через 1 годину, якщо вже відомий. */
function Outcome({ entry, after }: { entry: number; after: number | null }) {
  if (after === null) return <span className="text-muted">pending</span>;
  const pct = (after / entry - 1) * 100;
  return (
    <span className={`tabular ${pct >= 0 ? "text-bull" : "text-bear"}`}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

export default function SignalsPage() {
  const [symbol, setSymbol] = useState("");
  const [signalType, setSignalType] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  const [records, setRecords] = useState<SignalRecord[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSignals({ symbol, signalType, timeframe, dateFrom });
      setRecords(data);
      setError(null);
    } catch {
      setError("Signal history is temporarily unavailable. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [symbol, signalType, timeframe, dateFrom]);

  useEffect(() => {
    load();
    getSignalStats().then(setStats).catch(() => {});
  }, [load]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="flex items-center justify-between py-4">
        <h2 className="font-display text-base font-semibold text-ink">Signal history</h2>
        <Link to="/" className="text-sm text-muted transition-colors hover:text-ink">
          ← Back to markets
        </Link>
      </div>

      {/* Точність системи (Завдання 21) */}
      {stats && stats.evaluatedSignals > 0 && (
        <div className="mb-4 flex flex-wrap gap-5 rounded-2xl border border-border bg-panel px-5 py-3 text-sm">
          <span className="text-muted">
            Evaluated: <span className="tabular text-ink">{stats.evaluatedSignals}</span>
          </span>
          <span className="text-muted">
            Win rate (1h):{" "}
            <span className="tabular text-ink">
              {stats.winRate !== null ? `${stats.winRate}%` : "—"}
            </span>
          </span>
          <span className="text-muted">
            Avg result:{" "}
            <span
              className={`tabular ${
                (stats.averageResultPct ?? 0) >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              {stats.averageResultPct !== null
                ? `${stats.averageResultPct > 0 ? "+" : ""}${stats.averageResultPct}%`
                : "—"}
            </span>
          </span>
        </div>
      )}

      {/* Фільтри: криптовалюта, тип сигналу, таймфрейм, дата (Завдання 20) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={selectCls}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "All coins" : s.replace("USDT", "/USDT")}
            </option>
          ))}
        </select>
        <select
          value={signalType}
          onChange={(e) => setSignalType(e.target.value)}
          className={selectCls}
        >
          {SIGNAL_TYPES.map((s) => (
            <option key={s} value={s}>
              {s === "" ? "All signals" : s}
            </option>
          ))}
        </select>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className={selectCls}
        >
          {TIMEFRAMES.map((t) => (
            <option key={t} value={t}>
              {t === "" ? "All timeframes" : t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={selectCls}
          aria-label="From date"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-panel">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted">Loading signal history…</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No signals recorded yet. The bot checks BTC, ETH and SOL every 5 minutes and
            saves a record whenever a signal changes.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {records.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/analyze/${r.symbol}`}
                      className="font-mono text-sm text-ink hover:text-amber"
                    >
                      {r.symbol.replace("USDT", "")}
                      <span className="text-muted">/USDT</span>
                    </Link>
                    <SignalBadge signal={r.signal as SignalType} />
                    <span className="tabular text-xs text-muted">{r.timeframe}</span>
                    <span className="tabular text-xs text-muted">
                      {r.score > 0 ? "+" : ""}
                      {r.score}/8
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                      {r.riskLevel}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="tabular text-ink">${fmtPrice(r.price)}</span>
                    <span className="text-xs text-muted">
                      15m: <Outcome entry={r.price} after={r.priceAfter15m} />
                    </span>
                    <span className="text-xs text-muted">
                      1h: <Outcome entry={r.price} after={r.priceAfter1h} />
                    </span>
                    <span className="text-xs text-muted">
                      4h: <Outcome entry={r.price} after={r.priceAfter4h} />
                    </span>
                    {r.maxRisePct !== null && r.maxDropPct !== null && (
                      <span className="tabular text-xs text-muted">
                        hi <span className="text-bull">+{r.maxRisePct}%</span> / lo{" "}
                        <span className="text-bear">{r.maxDropPct}%</span>
                      </span>
                    )}
                    <span className="tabular text-xs text-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {r.reasons.length > 0 && (
                  <p className="mt-1 text-xs text-muted">{r.reasons.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
