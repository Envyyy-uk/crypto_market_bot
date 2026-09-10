import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMarkets } from "../context/MarketStreamContext";
import { getSignals, type SignalRecord } from "../api";
import PriceCard from "../components/PriceCard";
import MarketList from "../components/MarketList";
import CandleChart from "../components/CandleChart";
import SignalBadge from "../components/SignalBadge";
import type { SignalType } from "../types";
import { Card, CardHeader } from "../components/ui/Card";
import Skeleton from "../components/ui/Skeleton";

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
    <Card className="animate-fade-up">
      <CardHeader
        title="Latest signals"
        action={
          <Link to="/signals" className="text-xs text-muted transition-colors hover:text-ink">
            View all →
          </Link>
        }
      />
      <ul className="divide-y divide-border">
        {records.map((r) => (
          <li key={r.id}>
            <Link
              to={`/analyze/${r.symbol}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-panel2"
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
    </Card>
  );
}

export default function HomePage() {
  const { tickers, status } = useMarkets();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");

  const selected = tickers.find((t) => t.symbol === selectedSymbol);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-1 sm:px-6">
      {status === "offline" && (
        <div className="mb-4 rounded-card border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          Market data is temporarily unavailable. Reconnecting…
        </div>
      )}
      {status === "stale" && (
        <div className="mb-4 rounded-card border border-border bg-panel px-4 py-3 text-sm text-muted shadow-card">
          Prices are frozen: the server lost its connection to the exchange and is retrying.
        </div>
      )}

      {/* Hero: ціна + sparkline + 24h-статистика; поки даних немає — skeleton */}
      {selected ? (
        <PriceCard ticker={selected} />
      ) : (
        <Skeleton className="h-[132px] w-full rounded-card sm:h-[116px]" />
      )}

      {/* Швидкі дії */}
      {/* Головна дія візуально важча за дві другорядні — раніше всі три
          виглядали однаково й читались як вкладки, а не як кнопки */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Link
          to={`/analyze/${selectedSymbol}`}
          className="animate-fade-up rounded-control bg-accent px-3 py-3 text-center text-sm font-semibold text-deep transition-opacity hover:opacity-90"
        >
          Analyze
        </Link>
        <Link
          to="/signals"
          className="animate-fade-up rounded-control border border-border bg-panel px-3 py-3 text-center text-sm font-medium text-ink shadow-card transition-colors hover:bg-panel2"
        >
          Signals
        </Link>
        <Link
          to="/alerts"
          className="animate-fade-up rounded-control border border-border bg-panel px-3 py-3 text-center text-sm font-medium text-ink shadow-card transition-colors hover:bg-panel2"
        >
          Alerts
        </Link>
      </div>

      {/*
        На широкому екрані колонка ринків набагато вища за графік, тож під
        графіком зяяла порожнеча майже на його висоту. Тепер "Latest signals"
        стоїть під графіком у лівій колонці, а список ринків займає праву на
        дві строки. Порядок у DOM лишається графік -> ринки -> сигнали, тож на
        телефоні (одна колонка) послідовність та сама, що й була.
      */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        {/* Підказку про перехід перенесено в шапку картки й вона видима
            завжди. Раніше вона з'являлась лише на наведення — а на телефоні
            наведення не існує, тож на головному пристрої застосунку її не
            бачив ніхто; до того ж унизу вона налазила на підписи осі часу. */}
        <Link
          to={`/analyze/${selectedSymbol}`}
          aria-label={`Open full ${selectedSymbol} chart and analysis`}
          className="block transition-opacity hover:opacity-90 lg:col-start-1 lg:row-start-1"
        >
          <CandleChart
            symbol={selectedSymbol}
            preview
            action={
              <span className="shrink-0 rounded-control border border-border bg-panel2 px-2.5 py-1 text-xs font-medium text-accent">
                Open full chart →
              </span>
            }
          />
        </Link>
        <div className="lg:col-start-2 lg:row-span-2">
          <MarketList
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <LatestSignals />
        </div>
      </div>
    </main>
  );
}
