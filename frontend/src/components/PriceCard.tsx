import type { MarketTicker } from "../types";

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 });
}

function formatVolume(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toFixed(0);
}

// Велика "hero" картка для головної монети сторінки (за замовчуванням BTC/USDT)
export default function PriceCard({ ticker }: { ticker: MarketTicker }) {
  const positive = ticker.change24h >= 0;
  const base = ticker.symbol.replace("USDT", "");

  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <p className="font-mono text-sm font-semibold text-ink">{base}/USDT</p>
          <p className={`tabular font-mono text-2xl font-semibold ${positive ? "text-bull" : "text-bear"}`}>
            ${formatPrice(ticker.price)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <div>
            <p className="text-muted">24h change</p>
            <p className={`tabular font-medium ${positive ? "text-bull" : "text-bear"}`}>
              {positive ? "+" : ""}
              {ticker.change24h.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted">24h high</p>
            <p className="tabular font-medium text-ink">{formatPrice(ticker.high24h)}</p>
          </div>
          <div>
            <p className="text-muted">24h low</p>
            <p className="tabular font-medium text-ink">{formatPrice(ticker.low24h)}</p>
          </div>
          <div>
            <p className="text-muted">24h volume</p>
            <p className="tabular font-medium text-ink">{formatVolume(ticker.volume24h)} USDT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
