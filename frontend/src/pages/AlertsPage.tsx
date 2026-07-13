import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePushNotifications } from "../hooks/usePushNotifications";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const CONDITIONS = [
  { value: "price_above", label: "Price rises above" },
  { value: "price_below", label: "Price falls below" },
  { value: "rsi_above", label: "RSI (1h) rises above" },
  { value: "rsi_below", label: "RSI (1h) falls below" },
  { value: "signal_change", label: "Signal (1h) becomes" },
] as const;
const SIGNAL_OPTIONS = ["Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"];

interface AlertItem {
  id: number;
  symbol: string;
  conditionType: string;
  conditionValue: string;
  isActive: boolean;
  firedAt: string | null;
  firedValue: string | null;
  createdAt: string;
}

const inputCls =
  "rounded-lg border border-border bg-panel2 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-amber";

function describe(a: AlertItem): string {
  const pair = a.symbol.replace("USDT", "/USDT");
  switch (a.conditionType) {
    case "price_above":
      return `${pair} price rises above ${a.conditionValue} USDT`;
    case "price_below":
      return `${pair} price falls below ${a.conditionValue} USDT`;
    case "rsi_above":
      return `${pair} RSI (1h) rises above ${a.conditionValue}`;
    case "rsi_below":
      return `${pair} RSI (1h) falls below ${a.conditionValue}`;
    default:
      return `${pair} signal (1h) becomes ${a.conditionValue}`;
  }
}

export default function AlertsPage() {
  const { token, user } = useAuth();
  const push = usePushNotifications();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [conditionType, setConditionType] = useState<string>("price_above");
  const [conditionValue, setConditionValue] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignalCondition = conditionType === "signal_change";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setAlerts(await res.json());
      setError(null);
    } catch {
      setError("Alerts are temporarily unavailable. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          conditionType,
          conditionValue: isSignalCondition ? conditionValue || "Strong Buy" : conditionValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ?? "Could not create the alert.");
      setConditionValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the alert.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/alerts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Could not delete the alert. Please try again.");
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-sm px-4 pb-16 pt-8 sm:px-6">
        <div className="rounded-2xl border border-border bg-panel p-6 text-center">
          <p className="text-sm text-muted">Sign in to create price and signal alerts.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <h2 className="py-4 font-display text-base font-semibold text-ink">Alerts</h2>

      {/* Push-сповіщення (Завдання 15) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-panel px-4 py-3">
        <div>
          <p className="text-sm text-ink">Push notifications</p>
          <p className="text-xs text-muted">
            {push.state === "on" && "Enabled on this device — alerts arrive even when the app is closed."}
            {push.state === "off" && "Get alerts on this device even when the app is closed."}
            {push.state === "denied" && "Notifications are blocked in your browser settings for this site."}
            {push.state === "unsupported" && "This browser does not support push notifications."}
            {push.state === "unconfigured" && "Push is not configured on the server yet (VAPID keys)."}
            {push.state === "busy" && "Checking…"}
          </p>
        </div>
        {push.state === "on" ? (
          <button
            onClick={push.disable}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            Disable
          </button>
        ) : push.state === "off" ? (
          <button
            onClick={push.enable}
            className="rounded-lg bg-amber px-3 py-1.5 text-sm font-semibold text-deep transition-opacity hover:opacity-90"
          >
            Enable
          </button>
        ) : null}
      </div>

      {/* Форма створення */}
      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-panel p-4"
      >
        <span className="text-sm text-muted">Notify me when</span>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s.replace("USDT", "/USDT")}
            </option>
          ))}
        </select>
        <select
          value={conditionType}
          onChange={(e) => {
            setConditionType(e.target.value);
            setConditionValue("");
          }}
          className={inputCls}
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label.toLowerCase()}
            </option>
          ))}
        </select>
        {isSignalCondition ? (
          <select
            value={conditionValue || "Strong Buy"}
            onChange={(e) => setConditionValue(e.target.value)}
            className={inputCls}
          >
            {SIGNAL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step="any"
            required
            placeholder={conditionType.startsWith("rsi") ? "e.g. 30" : "e.g. 70000"}
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            className={`${inputCls} w-32`}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create alert"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
          {error}
        </p>
      )}

      {/* Список */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-panel">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            No alerts yet. Conditions are checked about once a minute.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm text-ink">{describe(a)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.isActive ? (
                      "Active — watching"
                    ) : (
                      <span className="text-amber">
                        Fired {a.firedAt ? new Date(a.firedAt).toLocaleString() : ""}
                        {a.firedValue ? ` at ${a.firedValue}` : ""}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  aria-label="Delete alert"
                  className="rounded-md px-2 py-1 text-muted transition-colors hover:text-bear"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Alerts fire once, then stay in the list as history. Conditions are checked about
        once a minute.
      </p>
    </main>
  );
}
