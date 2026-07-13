import { useNavigate } from "react-router-dom";
import { useMarkets } from "../context/MarketStreamContext";
import MarketList from "../components/MarketList";

/** Повний список ринків; дотик по монеті відкриває аналіз. */
export default function MarketsPage() {
  const { tickers, status } = useMarkets();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <h2 className="py-4 font-display text-base font-semibold text-ink">Markets</h2>

      {status === "offline" && (
        <div className="mb-4 rounded-xl border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          Market data is temporarily unavailable. Reconnecting…
        </div>
      )}

      <MarketList
        tickers={tickers}
        selectedSymbol=""
        onSelect={(symbol) => navigate(`/analyze/${symbol}`)}
      />
    </main>
  );
}
