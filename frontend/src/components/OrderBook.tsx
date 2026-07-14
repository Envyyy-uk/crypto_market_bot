import { useOrderBook, type OrderBookLevel } from "../hooks/useOrderBook";

function fmt(n: number, digits: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Row({
  level,
  side,
  maxSize,
  priceDigits,
}: {
  level: OrderBookLevel;
  side: "bid" | "ask";
  maxSize: number;
  priceDigits: number;
}) {
  const pct = maxSize > 0 ? Math.min((level.size / maxSize) * 100, 100) : 0;
  const barColor = side === "bid" ? "bg-bull/10" : "bg-bear/10";
  const textColor = side === "bid" ? "text-bull" : "text-bear";

  return (
    <div className="relative grid grid-cols-2 px-3 py-[3px] text-xs">
      <div
        className={`absolute inset-y-0 ${side === "bid" ? "right-0" : "left-0"} ${barColor}`}
        style={{ width: `${pct}%` }}
      />
      <span className={`tabular relative z-10 ${textColor}`}>{fmt(level.price, priceDigits)}</span>
      <span className="tabular relative z-10 text-right text-ink">{fmt(level.size, 4)}</span>
    </div>
  );
}

/** Жива глибина ринку (bid/ask) з Bybit WS — /ws/orderbook/{symbol}. */
export default function OrderBook({ symbol }: { symbol: string }) {
  const { bids, asks } = useOrderBook(symbol);

  const loading = bids.length === 0 && asks.length === 0;
  const maxSize = Math.max(0, ...bids.map((b) => b.size), ...asks.map((a) => a.size));

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestAsk ? (spread / bestAsk) * 100 : null;

  const refPrice = bestAsk ?? bestBid ?? 0;
  const priceDigits = refPrice > 0 && refPrice < 1 ? 6 : 2;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-medium text-ink">Order book</h2>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted">Loading order book…</div>
      ) : (
        <div className="py-1.5">
          <div className="grid grid-cols-2 px-3 py-1 text-[10px] uppercase tracking-wider text-muted">
            <span>Price</span>
            <span className="text-right">Size</span>
          </div>

          <div>
            {[...asks]
              .reverse()
              .map((level) => (
                <Row key={level.price} level={level} side="ask" maxSize={maxSize} priceDigits={priceDigits} />
              ))}
          </div>

          <div className="flex items-center justify-center gap-2 border-y border-border bg-panel2 px-3 py-1.5 text-xs">
            <span className="text-muted">Spread</span>
            <span className="tabular text-ink">{spread !== null ? fmt(spread, priceDigits) : "—"}</span>
            {spreadPct !== null && <span className="text-muted">({spreadPct.toFixed(4)}%)</span>}
          </div>

          <div>
            {bids.map((level) => (
              <Row key={level.price} level={level} side="bid" maxSize={maxSize} priceDigits={priceDigits} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
