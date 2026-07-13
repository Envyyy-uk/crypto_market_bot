import { createContext, useContext, type ReactNode } from "react";
import { useMarketStream } from "../hooks/useMarketStream";
import type { ConnectionStatus, MarketTicker } from "../types";

interface MarketStreamValue {
  tickers: MarketTicker[];
  status: ConnectionStatus;
}

const MarketStreamContext = createContext<MarketStreamValue>({
  tickers: [],
  status: "connecting",
});

/**
 * Провайдер тримає ЄДИНЕ WebSocket-з'єднання на весь застосунок.
 * Компоненти читають дані через useMarkets() — жодних дублікатів підключень
 * (вимога Завдання 4).
 */
export function MarketStreamProvider({ children }: { children: ReactNode }) {
  const value = useMarketStream();
  return (
    <MarketStreamContext.Provider value={value}>{children}</MarketStreamContext.Provider>
  );
}

export function useMarkets(): MarketStreamValue {
  return useContext(MarketStreamContext);
}
