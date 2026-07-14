import { useEffect, useRef, useState } from "react";
import type { MarketTicker } from "../types";
import Sparkline from "./Sparkline";

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 });
}

function formatVolume(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toFixed(0);
}

/** Спалах кольору при кожній зміні ціни: зелений вгору, червоний вниз. */
function useFlashOnChange(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value > prev.current ? "up" : "down");
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [value]);

  return flash;
}

// Hero-картка головної монети: ціна з flash-анімацією, sparkline 24h, статистика
export default function PriceCard({ ticker }: { ticker: MarketTicker }) {
  const positive = ticker.change24h >= 0;
  const base = ticker.symbol.replace("USDT", "");
  const flash = useFlashOnChange(ticker.price);

  return (
    <div className="animate-fade-up rounded-xl border border-border bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Пара + ціна */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold text-ink">{base}/USDT</p>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                positive ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
              }`}
            >
              {positive ? "+" : ""}
              {ticker.change24h.toFixed(2)}%
            </span>
          </div>
          <p
            className={`tabular mt-1 font-mono text-3xl font-bold leading-tight text-ink sm:text-4xl ${
              flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""
            }`}
          >
            ${formatPrice(ticker.price)}
          </p>
        </div>

        {/* Sparkline останніх 24 годин */}
        <div className="hidden min-w-[160px] max-w-[220px] flex-1 sm:block">
          <Sparkline symbol={ticker.symbol} />
        </div>

        {/* 24h статистика */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <div>
            <p className="text-muted">24h High</p>
            <p className="tabular font-medium text-ink">{formatPrice(ticker.high24h)}</p>
          </div>
          <div>
            <p className="text-muted">24h Low</p>
            <p className="tabular font-medium text-ink">{formatPrice(ticker.low24h)}</p>
          </div>
          <div>
            <p className="text-muted">24h Volume</p>
            <p className="tabular font-medium text-ink">{formatVolume(ticker.volume24h)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
