import type { SignalType } from "../types";

const STYLES: Record<SignalType, string> = {
  "Strong Buy": "bg-bull/15 text-bull border-bull/30",
  Buy: "bg-bull/10 text-bull border-bull/20",
  Neutral: "bg-panel2 text-muted border-border",
  Sell: "bg-bear/10 text-bear border-bear/20",
  "Strong Sell": "bg-bear/15 text-bear border-bear/30",
};

export default function SignalBadge({ signal = "Neutral" }: { signal?: SignalType }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-medium tabular ${STYLES[signal]}`}
    >
      {signal}
    </span>
  );
}
