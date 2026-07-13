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
    <div className="rounded-2xl border border-border bg-panel p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {base}/USDT
          </p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular text-ink sm:text-5xl">
            ${formatPrice(ticker.price)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-muted">24h change</p>
          <p className={`tabular font-medium ${positive ? "text-bull" : "text-bear"}`}>
            {positive ? "+" : ""}
            {ticker.change24h.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-muted">24h volume</p>
          <p className="tabular font-medium text-ink">{formatVolume(ticker.volume24h)} USDT</p>
        </div>
        <div>
          <p className="text-muted">24h range</p>
          <p className="tabular font-medium text-ink">
            {formatPrice(ticker.low24h)} – {formatPrice(ticker.high24h)}
          </p>
        </div>
      </div>
    </div>
  );
}
