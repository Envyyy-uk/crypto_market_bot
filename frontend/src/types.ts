// Відповідає MarketTicker з backend/app/models/schemas.py
export interface MarketTicker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export type ConnectionStatus = "connecting" | "online" | "offline";

// Відповідає Candle з backend/app/models/schemas.py
export interface Candle {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type SignalType = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";
export type TrendType = "bullish" | "bearish" | "neutral";
export type RiskLevel = "Low" | "Medium" | "High";

// Відповідає відповіді GET /api/analyze/{symbol}
export interface AnalysisResult {
  symbol: string;
  interval: Timeframe;
  price: number;
  trend: TrendType;
  signal: SignalType;
  score: number;
  maxScore: number;
  reasons: string[];
  support: number | null;
  resistance: number | null;
  riskLevel: RiskLevel;
  riskWarning: string | null;
  atrPct: number;
  indicators: {
    rsi: number;
    rsiStatus: string;
    ema20: number;
    ema50: number;
    emaTrend: string;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    macdStatus: string;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    bbStatus: string;
    atr: number;
    volumeChangePct: number;
    volumeStatus: string;
    [key: string]: number | string;
  };
  updatedAt: number;
}
