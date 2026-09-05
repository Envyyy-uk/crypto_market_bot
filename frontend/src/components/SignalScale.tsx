import type { SignalType } from "../types";

/**
 * Шкала сигналу від Strong Sell до Strong Buy із позначкою поточного балу.
 *
 * Замінює стару смужку «Strength +1/8», яка вводила в оману: вона малювала
 * |score| / maxScore, тож нейтральний сигнал із балом +1 показувався як
 * помітно залита смужка, а знак балу губився. Тепер видно всю шкалу й те,
 * де саме на ній стоїть поточний сигнал.
 *
 * Пороги збігаються з backend/app/analysis/signals.py:
 *   >= +6 Strong Buy | >= +3 Buy | >= -2 Neutral | >= -5 Sell | інакше Strong Sell
 */

const ZONES: { label: string; from: number; to: number; cls: string }[] = [
  { label: "Strong Sell", from: -8, to: -5, cls: "bg-bear/70" },
  { label: "Sell", from: -5, to: -2, cls: "bg-bear/35" },
  { label: "Neutral", from: -2, to: 3, cls: "bg-muted/25" },
  { label: "Buy", from: 3, to: 6, cls: "bg-bull/35" },
  { label: "Strong Buy", from: 6, to: 8, cls: "bg-bull/70" },
];

const MIN = -8;
const MAX = 8;

export default function SignalScale({
  score,
  signal,
}: {
  score: number;
  signal: SignalType;
}) {
  const clamped = Math.max(MIN, Math.min(MAX, score));
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;
  const markerCls = score >= 3 ? "bg-bull" : score <= -3 ? "bg-bear" : "bg-ink";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Signal strength</span>
        <span className="tabular text-xs text-muted">
          {signal} · {score > 0 ? "+" : ""}
          {score}
        </span>
      </div>

      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {ZONES.map((z) => (
            <div
              key={z.label}
              className={z.cls}
              style={{ width: `${((z.to - z.from) / (MAX - MIN)) * 100}%` }}
              title={z.label}
            />
          ))}
        </div>

        {/* Позначка поточного балу */}
        <div
          className={`absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel ${markerCls}`}
          style={{ left: `${pct}%` }}
          role="img"
          aria-label={`${signal}, score ${score} out of ${MIN} to ${MAX}`}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-muted">
        <span>Sell</span>
        <span>Neutral</span>
        <span>Buy</span>
      </div>
    </div>
  );
}
