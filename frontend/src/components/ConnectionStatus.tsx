import type { ConnectionStatus as Status } from "../types";

const CONFIG: Record<Status, { label: string; dot: string }> = {
  online: { label: "Connected", dot: "bg-bull" },
  connecting: { label: "Connecting…", dot: "bg-amber animate-pulse" },
  offline: { label: "Offline", dot: "bg-bear" },
};

export default function ConnectionStatus({ status }: { status: Status }) {
  const cfg = CONFIG[status];
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className="tabular">{cfg.label}</span>
    </div>
  );
}
