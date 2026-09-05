import type { MarketTicker } from "../types";
import Sparkline from "./Sparkline";
import { usePriceFlash } from "../hooks/usePriceFlash";
import { formatPercent, formatPrice, formatUsd, formatVolume } from "../lib/format";
import { Card } from "./ui/Card";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular whitespace-nowrap text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

/** Головна картка монети: ціна зі спалахом, sparkline 24h, статистика. */
export default function PriceCard({ ticker }: { ticker: MarketTicker }) {
  const positive = ticker.change24h >= 0;
  const base = ticker.symbol.replace("USDT", "");
  const flash = usePriceFlash(ticker.price);

  return (
    <Card className="animate-fade-up">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold text-ink">{base}/USDT</p>
            <span
              className={`rounded-control px-2 py-0.5 text-xs font-semibold ${
                positive ? "bg-bull/12 text-bull" : "bg-bear/12 text-bear"
              }`}
            >
              {formatPercent(ticker.change24h)}
            </span>
          </div>
          <p
            className={`tabular mt-1.5 font-mono text-[2.25rem] font-bold leading-none text-ink sm:text-5xl ${
              flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""
            }`}
          >
            {formatUsd(ticker.price)}
          </p>
        </div>

        {/* Sparkline показуємо і на телефоні: це головний натяк на напрямок */}
        <div className="h-12 w-full sm:h-14 sm:max-w-[240px] sm:flex-1">
          <Sparkline symbol={ticker.symbol} />
        </div>

        <div className="grid grid-cols-3 gap-x-6 sm:shrink-0">
          <Stat label="24h High" value={formatPrice(ticker.high24h)} />
          <Stat label="24h Low" value={formatPrice(ticker.low24h)} />
          <Stat label="Volume" value={formatVolume(ticker.volume24h)} />
        </div>
      </div>
    </Card>
  );
}
