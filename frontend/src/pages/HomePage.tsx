import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMarkets } from "../context/MarketStreamContext";
import { getSignals, type SignalRecord } from "../api";
import PriceCard from "../components/PriceCard";
import MarketList from "../components/MarketList";
import CandleChart from "../components/CandleChart";
import SignalBadge from "../components/SignalBadge";
import type { SignalType } from "../types";

/** Останні сигнали системи (Завдання 2: головна показує останні сигнали). */
function LatestSignals() {
  const [records, setRecords] = useState<SignalRecord[]>([]);

  useEffect(() => {
    getSignals({})
      .then((data) => setRecords(data.slice(0, 5)))
      .catch(() => {
        /* блок просто не показується */
      });
  }, []);

  if (records.length === 0) return null;

  return (
    <div className="animate-fade-up overflow-hidden rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display text-sm font-medium text-ink">Latest signals</h2>
        <Link to="/signals" className="text-xs text-muted transition-colors hover:text-ink">
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {records.map((r) => (
          <li key={r.id}>
            <Link
              to={`/analyze/${r.symbol}`}
              className="flex items-center justify-between px-4 py-2 transition-colors hover:bg-panel2"
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-sm text-ink">
                  {r.symbol.replace("USDT", "")}
                  <span className="text-muted">/USDT</span>
                </span>
                <SignalBadge signal={r.signal as SignalType} />
                <span className="tabular text-xs text-muted">{r.timeframe}</span>
              </span>
              <span className="tabular text-xs text-muted">
                {new Date(r.createdAt).toLocaleTimeString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const { tickers, status } = useMarkets();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");

  const selected = tickers.find((t) => t.symbol === selectedSymbol);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {status === "offline" && (
        <div className="mb-6 rounded-xl border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          Market data is temporarily unavailable. Reconnecting…
        </div>
      )}

      {/* Hero: ціна + sparkline + 24h-статистика; поки даних немає — skeleton */}
      {selected ? (
        <PriceCard ticker={selected} />
      ) : (
        <div className="skeleton h-[88px] w-full rounded-xl" />
      )}

      {/* Швидкі дії */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Link
          to={`/analyze/${selectedSymbol}`}
          className="animate-fade-up rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-center text-sm font-medium text-amber transition-colors hover:bg-amber/20"
        >
          Full analysis
        </Link>
        <Link
          to="/signals"
          className="animate-fade-up rounded-xl border border-border bg-panel px-3 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:bg-panel2"
        >
          Signals
        </Link>
        <Link
          to="/alerts"
          className="animate-fade-up rounded-xl border border-border bg-panel px-3 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:bg-panel2"
        >
          Alerts
        </Link>
      </div>

      {/* Сітка: превʼю графіка (клік -> повний аналіз) | ринки + сигнали */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Link
          to={`/analyze/${selectedSymbol}`}
          aria-label={`Open full ${selectedSymbol} chart and analysis`}
          className="group relative block transition-opacity hover:opacity-90"
        >
          <CandleChart symbol={selectedSymbol} preview />
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-border bg-panel2/90 px-2 py-1 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
            Open full chart →
          </span>
        </Link>
        <div className="space-y-3">
          <MarketList
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
          <LatestSignals />
        </div>
      </div>
    </main>
  );
}
