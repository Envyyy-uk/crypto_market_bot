import { useMemo, useState } from "react";
import type { MarketTicker } from "../types";
import { useFavourites } from "../context/FavouritesContext";

function formatPrice(n: number) {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n < 1 ? 6 : n < 10 ? 4 : 2,
  });
}

export default function MarketList({
  tickers,
  onSelect,
  selectedSymbol,
}: {
  tickers: MarketTicker[];
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
}) {
  const [query, setQuery] = useState("");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const { favourites, isFavourite, toggle } = useFavourites();

  const filtered = useMemo(() => {
    let list = tickers;
    if (onlyFavourites) {
      // Порядок як в обраному користувача
      list = favourites
        .map((s) => tickers.find((t) => t.symbol === s))
        .filter((t): t is MarketTicker => Boolean(t));
    }
    const q = query.trim().toUpperCase();
    if (!q) return list;
    return list.filter((t) => t.symbol.includes(q));
  }, [tickers, query, onlyFavourites, favourites]);

  return (
    <div className="flex max-h-[34rem] flex-col overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-medium text-ink">Markets</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyFavourites((v) => !v)}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                onlyFavourites
                  ? "border-amber/40 bg-amber/10 text-amber"
                  : "border-border text-muted hover:text-ink"
              }`}
            >
              ★ Favourites
            </button>
            <span className="tabular text-xs text-muted">{filtered.length}</span>
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search coin, e.g. PEPE"
          className="mt-2 w-full rounded-lg border border-border bg-panel2 px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-amber"
        />
      </div>

      <ul className="overflow-y-auto">
        {filtered.map((t) => {
          const positive = t.change24h >= 0;
          const active = t.symbol === selectedSymbol;
          return (
            <li key={t.symbol} className="flex items-center">
              <button
                onClick={() => toggle(t.symbol)}
                aria-label={
                  isFavourite(t.symbol)
                    ? `Remove ${t.symbol} from favourites`
                    : `Add ${t.symbol} to favourites`
                }
                className={`pl-3 pr-1 text-sm transition-colors ${
                  isFavourite(t.symbol) ? "text-amber" : "text-border hover:text-muted"
                }`}
              >
                ★
              </button>
              <button
                onClick={() => onSelect(t.symbol)}
                className={`flex w-full items-center justify-between py-2.5 pl-1 pr-5 text-left transition-colors hover:bg-panel2 ${
                  active ? "bg-panel2" : ""
                }`}
              >
                <span className="font-mono text-sm text-ink">
                  {t.symbol.replace("USDT", "")}
                  <span className="text-muted">/USDT</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="tabular text-sm text-ink">${formatPrice(t.price)}</span>
                  <span
                    className={`tabular w-16 text-right text-sm font-medium ${
                      positive ? "text-bull" : "text-bear"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {t.change24h.toFixed(2)}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}

        {filtered.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-muted">
            {onlyFavourites && !query
              ? "No favourites yet. Tap ★ next to a coin to add it."
              : `No coins match "${query}"`}
          </li>
        )}
      </ul>
    </div>
  );
}
