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
    <div className="overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
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
              className="flex items-center justify-between px-5 py-2.5 transition-colors hover:bg-panel2"
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
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {status === "offline" && (
        <div className="mb-6 rounded-xl border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          Market data is temporarily unavailable. Reconnecting…
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {selected ? (
            <>
              <PriceCard ticker={selected} />
              <Link
                to={`/analyze/${selected.symbol}`}
                className="block rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-center text-sm font-medium text-amber transition-colors hover:bg-amber/20"
              >
                Full analysis of {selected.symbol.replace("USDT", "")}/USDT →
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-panel p-8 text-sm text-muted">
              Loading price data…
            </div>
          )}
        </div>

        <div className="space-y-6">
          <MarketList
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
          <LatestSignals />
        </div>
      </div>

      <div className="mt-6">
        <CandleChart symbol={selectedSymbol} />
      </div>
    </main>
  );
}
