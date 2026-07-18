import { useEffect, useState } from "react";
import type { AnalysisResult } from "../types";

type TradeLevels = NonNullable<AnalysisResult["tradeLevels"]>;

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function priceDigits(n: number) {
  return n < 1 ? 6 : 2;
}

/** Ліквідаційна ціна для довільного плеча — та сама формула, що на бекенді. */
function liquidationAt(entry: number, leverage: number, mmr: number, direction: "long" | "short") {
  if (direction === "long") return entry * (1 - 1 / leverage + mmr);
  return entry * (1 + 1 / leverage - mmr);
}

/**
 * Панель пропонованих рівнів: перемикач Spot/Futures.
 * Spot — чисті відсотки руху до TP/SL без плеча.
 * Futures — повзунок плеча: ліквідація і PnL перераховуються наживо.
 */
export default function TradeLevelsPanel({ levels }: { levels: TradeLevels }) {
  const [mode, setMode] = useState<"spot" | "futures">("spot");
  const lev = levels.leverage;

  // Стартове плече: безпечне (не вище maxSafe і не вище 5x за замовчуванням)
  const [leverage, setLeverage] = useState(1);
  useEffect(() => {
    if (lev) setLeverage(Math.min(5, Math.floor(lev.maxSafeLeverage)) || 1);
  }, [lev]);

  const isLong = levels.direction === "long";
  const digits = priceDigits(levels.entry);

  // Рух ціни до TP/SL у відсотках (без плеча)
  const tpMovePct = ((levels.takeProfit - levels.entry) / levels.entry) * 100 * (isLong ? 1 : -1);
  const slMovePct = ((levels.stopLoss - levels.entry) / levels.entry) * 100 * (isLong ? 1 : -1);

  const liqPrice =
    lev && mode === "futures"
      ? liquidationAt(levels.entry, leverage, lev.maintenanceMarginRate, levels.direction)
      : null;
  const overSafe = lev !== null && mode === "futures" && leverage > lev.maxSafeLeverage;

  const pnlMult = mode === "futures" ? leverage : 1;

  return (
    <div className="animate-fade-up mt-3 rounded-xl border border-border bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted">Suggested trade levels</p>
        <div className="flex items-center gap-2">
          {/* Spot / Futures */}
          <div className="flex rounded-lg border border-border bg-panel2 p-0.5">
            {(["spot", "futures"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  mode === m ? "bg-amber text-deep" : "text-muted hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
              isLong
                ? "border-bull/20 bg-bull/10 text-bull"
                : "border-bear/20 bg-bear/10 text-bear"
            }`}
          >
            {isLong ? "Long" : "Short"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted">Entry</p>
          <p className="tabular mt-1 text-sm font-semibold text-ink">
            ${fmt(levels.entry, digits)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Stop loss</p>
          <p className="tabular mt-1 text-sm font-semibold text-bear">
            ${fmt(levels.stopLoss, digits)}
          </p>
          <p className="tabular text-[11px] text-bear/80">
            {fmt(slMovePct * pnlMult, 1)}% {mode === "futures" ? "PnL" : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Take profit</p>
          <p className="tabular mt-1 text-sm font-semibold text-bull">
            ${fmt(levels.takeProfit, digits)}
          </p>
          <p className="tabular text-[11px] text-bull/80">
            +{fmt(tpMovePct * pnlMult, 1)}% {mode === "futures" ? "PnL" : ""}
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Risk/reward ≈ 1:{fmt(levels.riskRewardRatio, 1)}
      </p>

      {/* Futures: повзунок плеча + ліквідація наживо */}
      {mode === "futures" && lev && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted">Leverage</p>
            <span className="tabular text-base font-semibold text-amber">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={lev.maxLeverageCeiling}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="mt-2 w-full accent-amber"
            aria-label="Leverage"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>1x</span>
            <span className="text-amber">safe ≤ {fmt(lev.maxSafeLeverage, 1)}x</span>
            <span>{lev.maxLeverageCeiling}x</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted">Est. liquidation</p>
              <p className={`tabular font-semibold ${overSafe ? "text-bear" : "text-ink"}`}>
                ${liqPrice !== null ? fmt(liqPrice, digits) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted">Margin used (of position)</p>
              <p className="tabular font-semibold text-ink">{fmt(100 / leverage, 1)}%</p>
            </div>
          </div>

          {overSafe && (
            <p className="mt-3 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
              At {leverage}x the estimated liquidation is closer than your stop-loss — the
              exchange would liquidate before the stop triggers. Stay at or below{" "}
              {fmt(lev.maxSafeLeverage, 1)}x for this setup.
            </p>
          )}
          {lev.warning && !overSafe && (
            <p className="mt-3 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
              {lev.warning}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">{lev.note}</p>
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{levels.note}</p>
    </div>
  );
}
