import { useMemo, useState } from "react";
import type { MarketTicker } from "../types";
import { useFavourites } from "../context/FavouritesContext";
import { usePriceFlash } from "../hooks/usePriceFlash";
import { formatPercent, formatUsd } from "../lib/format";
import { Card } from "./ui/Card";

/**
 * Порядок за замовчуванням. Раніше сортування не було взагалі: список
 * ішов у порядку ключів об'єкта тікерів, тобто в порядку, у якому монети
 * вперше прилетіли по WebSocket — фактично випадковому, через що BTC
 * опинявся дев'ятим. Тепер великі монети зверху у звичному порядку,
 * решта — за обсягом торгів.
 */
const MAJORS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT"];

type SortKey = "default" | "change" | "volume" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  default: "Top",
  change: "24h %",
  volume: "Volume",
  name: "Name",
};

function sortTickers(list: MarketTicker[], key: SortKey): MarketTicker[] {
  const copy = [...list];
  switch (key) {
    case "change":
      return copy.sort((a, b) => b.change24h - a.change24h);
    case "volume":
      return copy.sort((a, b) => b.volume24h - a.volume24h);
    case "name":
      return copy.sort((a, b) => a.symbol.localeCompare(b.symbol));
    default:
      return copy.sort((a, b) => {
        const ai = MAJORS.indexOf(a.symbol);
        const bi = MAJORS.indexOf(b.symbol);
        if (ai !== -1 || bi !== -1) {
          return (ai === -1 ? MAJORS.length : ai) - (bi === -1 ? MAJORS.length : bi);
        }
        return b.volume24h - a.volume24h;
      });
  }
}

function MarketRow({
  ticker,
  active,
  isFav,
  onSelect,
  onToggleFav,
}: {
  ticker: MarketTicker;
  active: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}) {
  const positive = ticker.change24h >= 0;
  // Спалах тла рядка на кожній зміні ціни — інакше оновлення непомітні.
  const flash = usePriceFlash(ticker.price);

  return (
    <li
      className={`flex items-center border-b border-border/60 last:border-b-0 ${
        active ? "bg-accent/[0.07]" : ""
      } ${flash === "up" ? "animate-row-flash-up" : flash === "down" ? "animate-row-flash-down" : ""}`}
    >
      <button
        onClick={onToggleFav}
        aria-label={isFav ? `Remove ${ticker.symbol} from favourites` : `Add ${ticker.symbol} to favourites`}
        aria-pressed={isFav}
        className={`shrink-0 py-2.5 pl-3 pr-1.5 text-sm transition-colors ${
          isFav ? "text-accent" : "text-border hover:text-muted"
        }`}
      >
        ★
      </button>
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pl-1 pr-4 text-left transition-colors hover:bg-panel2"
      >
        <span className="min-w-0 truncate font-mono text-[13px] font-medium text-ink">
          {ticker.symbol.replace("USDT", "")}
          <span className="text-muted">/USDT</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="tabular text-[13px] text-ink">{formatUsd(ticker.price)}</span>
          <span
            className={`tabular w-[4.5rem] text-right text-[13px] font-semibold ${
              positive ? "text-bull" : "text-bear"
            }`}
          >
            {formatPercent(ticker.change24h)}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function MarketList({
  tickers,
  onSelect,
  selectedSymbol,
  title = "Markets",
  /** На окремій сторінці /markets список займає всю висоту, а не 40rem. */
  fullHeight = false,
}: {
  tickers: MarketTicker[];
  onSelect: (symbol: string) => void;
  selectedSymbol: string;
  title?: string;
  fullHeight?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const { favourites, isFavourite, toggle } = useFavourites();

  const filtered = useMemo(() => {
    let list = tickers;
    if (onlyFavourites) {
      // В обраному порядок задає користувач, тож сортування не застосовуємо.
      list = favourites
        .map((s) => tickers.find((t) => t.symbol === s))
        .filter((t): t is MarketTicker => Boolean(t));
    } else {
      list = sortTickers(list, sortKey);
    }
    const q = query.trim().toUpperCase();
    return q ? list.filter((t) => t.symbol.includes(q)) : list;
  }, [tickers, query, onlyFavourites, favourites, sortKey]);

  return (
    <Card className="animate-fade-up flex flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyFavourites((v) => !v)}
              aria-pressed={onlyFavourites}
              className={`rounded-control border px-2.5 py-1 text-xs font-medium transition-colors ${
                onlyFavourites
                  ? "border-accent/40 bg-accent/10 text-accent"
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
          aria-label="Search coin"
          className="mt-3 w-full rounded-control border border-border bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />

        {/* Сортування ховаємо в режимі обраного — там порядок ручний */}
        {!onlyFavourites && (
          <div className="mt-3 flex gap-1 rounded-control bg-panel2 p-1">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                aria-pressed={sortKey === key}
                className={`flex-1 rounded-[0.375rem] px-2 py-1 text-xs font-medium transition-colors ${
                  sortKey === key
                    ? "bg-panel text-ink shadow-card"
                    : "text-muted hover:text-ink"
                }`}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-border px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted">
        <span className="pl-5">Pair</span>
        <span className="flex gap-3">
          <span>Price</span>
          <span className="w-[4.5rem] text-right">24h %</span>
        </span>
      </div>

      {/* max-h лише коли список стоїть збоку від графіка; на своїй
          сторінці він розкривається повністю, щоб рядок не різався навпіл */}
      <ul className={`overflow-y-auto overscroll-contain ${fullHeight ? "" : "max-h-[26rem]"}`}>
        {filtered.map((t) => (
          <MarketRow
            key={t.symbol}
            ticker={t}
            active={t.symbol === selectedSymbol}
            isFav={isFavourite(t.symbol)}
            onSelect={() => onSelect(t.symbol)}
            onToggleFav={() => toggle(t.symbol)}
          />
        ))}

        {filtered.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted">
            {onlyFavourites && !query
              ? "No favourites yet. Tap ★ next to a coin to add it."
              : `No coins match “${query}”`}
          </li>
        )}
      </ul>
    </Card>
  );
}
