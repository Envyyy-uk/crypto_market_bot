import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, MarketTicker } from "../types";

const httpBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const WS_BASE = httpBase.startsWith("https")
  ? httpBase.replace("https", "wss")
  : httpBase.replace("http", "ws");

const MIN_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 15000;

function isValidTicker(x: unknown): x is MarketTicker {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.symbol === "string" &&
    typeof t.price === "number" &&
    typeof t.change24h === "number"
  );
}

/**
 * Підключається до /ws/markets і тримає актуальну мапу тікерів у стані.
 * Автоматично перепідключається після втрати з'єднання (Завдання 4) і
 * гарантує лише ОДНЕ активне з'єднання на компонент.
 */
export function useMarketStream() {
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>({});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const socketRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(MIN_RETRY_DELAY);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (socketRef.current) return; // не створювати декілька однакових підключень
      setStatus("connecting");

      const socket = new WebSocket(`${WS_BASE}/ws/markets`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelayRef.current = MIN_RETRY_DELAY;
        setStatus("online");
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "snapshot" && Array.isArray(msg.data)) {
            const valid = msg.data.filter(isValidTicker) as MarketTicker[];
            setTickers(Object.fromEntries(valid.map((t) => [t.symbol, t])));
          } else if (msg.type === "update" && isValidTicker(msg.data)) {
            setTickers((prev) => ({ ...prev, [msg.data.symbol]: msg.data }));
          }
          // Некоректні/невідомі повідомлення тихо ігноруємо.
        } catch {
          // Биті JSON-дані ігноруємо, чекаємо наступне повідомлення.
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (unmountedRef.current) return;
        setStatus("offline");
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
  }, []);

  return { tickers: Object.values(tickers), status };
}
