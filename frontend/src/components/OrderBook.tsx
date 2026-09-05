import { useState } from "react";
import { useOrderBook, type OrderBookLevel } from "../hooks/useOrderBook";
import { priceDecimals } from "../lib/format";
import { Card } from "./ui/Card";

function fmt(n: number, digits: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Скільки рівнів видно одразу на телефоні; решта — лише на широкому екрані. */
const MOBILE_LEVELS = 7;

function Row({
  level,
  side,
  maxSize,
  priceDigits,
  beyondMobile,
}: {
  level: OrderBookLevel;
  side: "bid" | "ask";
  maxSize: number;
  priceDigits: number;
  beyondMobile: boolean;
}) {
  const pct = maxSize > 0 ? Math.min((level.size / maxSize) * 100, 100) : 0;
  const barColor = side === "bid" ? "bg-bull/12" : "bg-bear/12";
  const textColor = side === "bid" ? "text-bull" : "text-bear";

  return (
    <div
      className={`relative grid grid-cols-2 px-4 py-[3px] text-xs ${
        beyondMobile ? "hidden sm:grid" : ""
      }`}
    >
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
  // На телефоні ордербук згорнутий: 30 рядків підряд розтягували сторінку
  // так, що бек-тест і індикатори опинялись далеко за межею екрана.
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const loading = bids.length === 0 && asks.length === 0;
  const maxSize = Math.max(0, ...bids.map((b) => b.size), ...asks.map((a) => a.size));

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestAsk ? (spread / bestAsk) * 100 : null;

  const refPrice = bestAsk ?? bestBid ?? 0;
  const digits = priceDecimals(refPrice || 1);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-ink">Order book</h2>
        <div className="flex items-center gap-3">
          {spread !== null && (
            <span className="tabular text-xs text-muted">
              spread {fmt(spread, digits)}
              {spreadPct !== null && ` (${spreadPct.toFixed(3)}%)`}
            </span>
          )}
          <button
            onClick={() => setOpenOnMobile((v) => !v)}
            aria-expanded={openOnMobile}
            className="rounded-control border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-ink sm:hidden"
          >
            {openOnMobile ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted">Loading order book…</div>
      ) : (
        <div className={`py-1.5 ${openOnMobile ? "" : "hidden sm:block"}`}>
          <div className="grid grid-cols-2 px-4 py-1 text-[10px] uppercase tracking-wider text-muted">
            <span>Price</span>
            <span className="text-right">Size</span>
          </div>

          {/* Аски згори вниз до спреду — як у біржовому стакані */}
          {[...asks]
            .reverse()
            .map((level, i, arr) => (
              <Row
                key={level.price}
                level={level}
                side="ask"
                maxSize={maxSize}
                priceDigits={digits}
                beyondMobile={arr.length - i > MOBILE_LEVELS}
              />
            ))}

          <div className="my-1 flex items-center justify-center gap-2 border-y border-border bg-panel2 px-4 py-2 text-xs">
            <span className="text-muted">Spread</span>
            <span className="tabular font-medium text-ink">
              {spread !== null ? fmt(spread, digits) : "—"}
            </span>
            {spreadPct !== null && <span className="text-muted">({spreadPct.toFixed(4)}%)</span>}
          </div>

          {bids.map((level, i) => (
            <Row
              key={level.price}
              level={level}
              side="bid"
              maxSize={maxSize}
              priceDigits={digits}
              beyondMobile={i >= MOBILE_LEVELS}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
