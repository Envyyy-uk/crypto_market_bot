import { useNavigate } from "react-router-dom";
import { useMarkets } from "../context/MarketStreamContext";
import MarketList from "../components/MarketList";

/** Повний список ринків; дотик по монеті відкриває аналіз. */
export default function MarketsPage() {
  const { tickers, status } = useMarkets();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:px-6">
      {status === "offline" && (
        <div className="mb-4 rounded-card border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
          Market data is temporarily unavailable. Reconnecting…
        </div>
      )}

      {/* Заголовок сторінки не дублюємо: він уже є в шапці картки,
          а два однакові «Markets» підряд виглядали як помилка. */}
      <MarketList
        tickers={tickers}
        selectedSymbol=""
        onSelect={(symbol) => navigate(`/analyze/${symbol}`)}
        title="All markets"
        fullHeight
      />
    </main>
  );
}
