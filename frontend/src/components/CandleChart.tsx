import { useEffect, useRef, useState } from "react";
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

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

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

export default function CandleChart({
  symbol,
  interval: controlledInterval,
  onIntervalChange,
  preview = false,
}: {
  symbol: string;
  interval?: Timeframe;
  onIntervalChange?: (tf: Timeframe) => void;
  /** Компактний нередагований превʼю-режим для головної: без кнопок і взаємодії. */
  preview?: boolean;
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
      height: preview ? 260 : 420,
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
      if (width) chart.applyOptions({ width });
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

        candleSeriesRef.current?.setData(
          candles.map((c) => ({
            time: Math.floor(c.time / 1000) as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );

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
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, theme, preview]);

  return (
    <div className="animate-fade-up rounded-xl border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-medium text-ink">
          {symbol.replace("USDT", "")}/USDT {preview ? "· 24h preview" : "chart"}
        </h2>
        {!preview && (
          <div className="flex gap-1 rounded-lg border border-border bg-panel2 p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setInterval(tf)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                  tf === interval
                    ? "bg-amber text-deep font-semibold"
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
        {loading && (
          <div
            className="skeleton absolute inset-0"
            style={{ height: preview ? 260 : 420 }}
          />
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-panel/80 text-sm text-bear">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
