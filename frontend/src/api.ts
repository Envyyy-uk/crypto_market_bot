import type { AnalysisResult, Candle, MarketTicker, Timeframe } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function getMarkets(): Promise<MarketTicker[]> {
  const res = await fetch(`${API_BASE}/api/markets`);
  if (!res.ok) {
    throw new Error("Market data is temporarily unavailable. Please try again later.");
  }
  return res.json();
}

export async function getCandles(
  symbol: string,
  interval: Timeframe = "15m",
  limit = 500
): Promise<Candle[]> {
  const res = await fetch(
    `${API_BASE}/api/candles/${symbol}?interval=${interval}&limit=${limit}`
  );
  if (!res.ok) {
    throw new Error("Market data is temporarily unavailable. Please try again later.");
  }
  return res.json();
}

export async function getAnalysis(
  symbol: string,
  interval: Timeframe = "1h"
): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/analyze/${symbol}?interval=${interval}`);
  if (!res.ok) {
    throw new Error("Market data is temporarily unavailable. Please try again later.");
  }
  return res.json();
}

export interface SignalRecord {
  id: number;
  symbol: string;
  timeframe: string;
  signal: string;
  score: number;
  price: number;
  riskLevel: string;
  reasons: string[];
  priceAfter15m: number | null;
  priceAfter1h: number | null;
  priceAfter4h: number | null;
  maxRisePct: number | null;
  maxDropPct: number | null;
  createdAt: string;
}

export async function getSignals(filters: {
  symbol?: string;
  signalType?: string;
  timeframe?: string;
  dateFrom?: string;
}): Promise<SignalRecord[]> {
  const params = new URLSearchParams();
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.signalType) params.set("signalType", filters.signalType);
  if (filters.timeframe) params.set("timeframe", filters.timeframe);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  const res = await fetch(`${API_BASE}/api/signals?${params}`);
  if (!res.ok) {
    throw new Error("Signal history is temporarily unavailable.");
  }
  return res.json();
}

export interface SignalStats {
  evaluatedSignals: number;
  successfulSignals: number;
  winRate: number | null;
  averageResultPct: number | null;
}

export async function getSignalStats(): Promise<SignalStats> {
  const res = await fetch(`${API_BASE}/api/signals/stats`);
  if (!res.ok) throw new Error("Stats unavailable");
  return res.json();
}

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Server unreachable");
  return res.json();
}
