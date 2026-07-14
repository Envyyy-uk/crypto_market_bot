import { useEffect, useState } from "react";
import { getCandles } from "../api";

const POINTS = 48; // 48 x 30m = останні 24 години
const W = 220;
const H = 56;

/**
 * SVG-мініграфік ціни за останні 24 години (sparkline) з м'яким градієнтом.
 * Колір слідує за напрямком: зростання — bull, падіння — bear.
 */
export default function Sparkline({ symbol }: { symbol: string }) {
  const [points, setPoints] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getCandles(symbol, "1h", POINTS)
      .then((candles) => {
        if (!cancelled) setPoints(candles.map((c) => c.close));
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (points === null) return <div className="skeleton h-14 w-full max-w-[220px]" />;
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = W / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - 4 - ((p - min) / span) * (H - 8);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;

  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? "rgb(var(--c-bull))" : "rgb(var(--c-bear))";
  const gradId = `spark-${rising ? "up" : "down"}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-14 w-full max-w-[220px]"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
