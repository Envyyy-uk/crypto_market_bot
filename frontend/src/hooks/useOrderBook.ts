import { useEffect, useRef, useState } from "react";

const httpBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const WS_BASE = httpBase.startsWith("https")
  ? httpBase.replace("https", "wss")
  : httpBase.replace("http", "ws");

const MIN_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 15000;

export interface OrderBookLevel {
  price: number;
  size: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

function isValidBook(x: unknown): x is OrderBookData {
  if (!x || typeof x !== "object") return false;
  const b = x as Record<string, unknown>;
  return Array.isArray(b.bids) && Array.isArray(b.asks);
}

/** Живий ордербук (bid/ask) для однієї пари — /ws/orderbook/{symbol}. */
export function useOrderBook(symbol: string) {
  const [book, setBook] = useState<OrderBookData>({ bids: [], asks: [] });

  const socketRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(MIN_RETRY_DELAY);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    setBook({ bids: [], asks: [] });

    function connect() {
      if (socketRef.current) return;

      const socket = new WebSocket(`${WS_BASE}/ws/orderbook/${symbol}`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelayRef.current = MIN_RETRY_DELAY;
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg.type === "snapshot" || msg.type === "update") && isValidBook(msg.data)) {
            setBook(msg.data);
          }
        } catch {
          // биті дані ігноруємо
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (unmountedRef.current) return;
        retryTimerRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY);
          connect();
        }, retryDelayRef.current);
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [symbol]);

  return book;
}
