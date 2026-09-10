import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getCandles } from "../api";
import type { Timeframe } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useMarkets } from "../context/MarketStreamContext";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

/**
 * Як часто перезавантажувати серію свічок.
 *
 * Жива ціна рухає лише ОСТАННЮ свічку (див. нижче). Щоб на графіку
 * з'являлися нові свічки, коли поточна закривається, серію треба час від
 * часу перечитувати. Хвилина — компроміс: для 1m це майже точно момент
 * закриття, для старших таймфреймів просто трохи зайвого трафіку.
 */
const RELOAD_MS = 60_000;

/**
 * Наскільки жива ціна може відрізнятись від останньої свічки, щоб ми
 * все ще вважали її тією самою свічкою.
 *
 * Свічки приходять з Binance, а жива ціна — з Bybit WS (гібридна схема,
 * див. backend/app/services/candles.py). Зазвичай вони збігаються з
 * точністю до дрібниць, але якщо джерела розійдуться — наприклад, одне
 * віддає застарілі дані — оновлення намалює різкий шип і зіпсує масштаб
 * усього графіка. У такому разі краще лишити свічку як є.
 */
const MAX_DIVERGENCE = 0.05;

/** Кольори з CSS-змінних теми (Завдання 18) — графік слідує за темою. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name: string) => `rgb(${css.getPropertyValue(name).trim().split(/\s+/).join(",")})`;
  return {
    bg: rgb("--c-panel"),
    grid: rgb("--c-panel2"),
    text: rgb("--c-muted"),
    border: rgb("--c-border"),
    bull: rgb("--c-bull"),
    bear: rgb("--c-bear"),
  };
}

/**
 * Висота полотна. Прев'ю на широкому екрані стоїть поруч із колонкою
 * ринків, тож фіксовані 260px лишали під ним порожнє місце — від 600px ширини
 * розтягуємо полотно до 380.
 */
function chartHeight(preview: boolean, width: number): number {
  if (!preview) return 420;
  return width >= 600 ? 380 : 260;
}

export default function CandleChart({
  symbol,
  interval: controlledInterval,
  onIntervalChange,
  preview = false,
  action,
}: {
  symbol: string;
  interval?: Timeframe;
  onIntervalChange?: (tf: Timeframe) => void;
  /** Компактний нередагований превʼю-режим для головної: без кнопок і взаємодії. */
  preview?: boolean;
  /** Дія праворуч у шапці картки (у превʼю — перехід до повного аналізу). */
  action?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [internalInterval, setInternalInterval] = useState<Timeframe>("15m");
  const interval = controlledInterval ?? internalInterval;
  const setInterval = (tf: Timeframe) => {
    if (onIntervalChange) onIntervalChange(tf);
    else setInternalInterval(tf);
  };

  // Остання свічка серії: жива ціна рухає їй close, розсуваючи high/low.
  // Без цього графік був мертвий — ціна поруч тікала, а свічки стояли.
  const lastCandleRef = useRef<{
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const { tickers } = useMarkets();
  const livePrice = tickers.find((t) => t.symbol === symbol)?.price;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolved: theme } = useTheme();
  const colorsRef = useRef(themeColors());

  // Створюємо графік один раз при монтуванні
  useEffect(() => {
    if (!containerRef.current) return;
    const c = themeColors();
    colorsRef.current = c;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      crosshair: { mode: preview ? CrosshairMode.Hidden : CrosshairMode.Normal },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: chartHeight(preview, containerRef.current.clientWidth),
      handleScroll: !preview,
      handleScale: !preview,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: c.bull,
      downColor: c.bear,
      borderVisible: false,
      wickUpColor: c.bull,
      wickDownColor: c.bear,
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.28 } });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Можливість масштабування й переміщення графіка вбудована в бібліотеку
    // (drag = переміщення, колесо миші / pinch = масштабування).

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width, height: chartHeight(preview, width) });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [preview]);

  // Перефарбування при зміні теми (без перестворення графіка)
  useEffect(() => {
    const c = themeColors();
    colorsRef.current = c;
    chartRef.current?.applyOptions({
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    candleSeriesRef.current?.applyOptions({
      upColor: c.bull,
      downColor: c.bear,
      wickUpColor: c.bull,
      wickDownColor: c.bear,
    });
  }, [theme]);

  // Довантажуємо свічки при зміні монети або таймфрейму
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Preview: фіксовані ~48 годин на 1h-свічках, без вибору таймфрейму
        const candles = await getCandles(symbol, preview ? "1h" : interval, preview ? 48 : 500);
        if (cancelled) return;

        const bars = candles.map((c) => ({
          time: Math.floor(c.time / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeriesRef.current?.setData(bars);

        const last = bars[bars.length - 1];
        lastCandleRef.current = last
          ? { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close }
          : null;

        volumeSeriesRef.current?.setData(
          candles.map((c) => ({
            time: Math.floor(c.time / 1000) as UTCTimestamp,
            value: c.volume,
            color:
              c.close >= c.open
                ? colorsRef.current.bull.replace("rgb", "rgba").replace(")", ",0.4)")
                : colorsRef.current.bear.replace("rgb", "rgba").replace(")", ",0.4)"),
          }))
        );

        chartRef.current?.timeScale().fitContent();
      } catch {
        if (!cancelled) {
          setError("Market data is temporarily unavailable. Please try again later.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Періодичне перечитування, щоб на графіку з'являлись нові свічки
    const timer = window.setInterval(load, RELOAD_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [symbol, interval, theme, preview]);

  // Жива ціна: рухаємо останню свічку, не перемальовуючи всю серію
  useEffect(() => {
    const bar = lastCandleRef.current;
    if (livePrice === undefined || !bar || !candleSeriesRef.current) return;
    if (Math.abs(livePrice - bar.close) / bar.close > MAX_DIVERGENCE) return;
    bar.high = Math.max(bar.high, livePrice);
    bar.low = Math.min(bar.low, livePrice);
    candleSeriesRef.current.update({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: livePrice,
    });
  }, [livePrice]);

  return (
    <div className="animate-fade-up rounded-card border border-border bg-panel p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">
          {symbol.replace("USDT", "")}/USDT
          {preview && <span className="ml-1.5 font-normal text-muted">· 24h preview</span>}
        </h2>
        {action}
        {!preview && (
          <div className="flex gap-1 rounded-control border border-border bg-panel2 p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setInterval(tf)}
                className={`rounded-[0.375rem] px-2.5 py-1 font-mono text-xs transition-colors ${
                  tf === interval
                    ? "bg-accent font-semibold text-deep"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <div ref={containerRef} />
        {loading && <div className="skeleton absolute inset-0" />}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/80 text-sm text-bear">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
