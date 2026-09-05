/**
 * Форматування чисел — одне на весь застосунок.
 *
 * Раніше кожен компонент мав власну formatPrice із власними правилами, і
 * мемкоїни від цього страждали: PEPE за $0.0000082 показувався як
 * $0.000007, бо фіксовані 6 знаків після коми зрізали значущу цифру.
 * Тут кількість знаків рахується від масштабу числа, а не задана наперед.
 */

/** Скільки знаків після коми треба, щоб лишилось ~5 значущих цифр. */
function decimalsFor(n: number): number {
  const abs = Math.abs(n);
  if (abs === 0) return 2;
  if (abs >= 100) return 2;
  if (abs >= 1) return 4;
  // 0.0000082 -> log10 ≈ -5.09 -> 5 нулів після коми -> 5 + 4 знаки
  const leadingZeros = Math.floor(-Math.log10(abs));
  return Math.min(leadingZeros + 4, 12);
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimalsFor(n),
  });
}

/** Ціна з символом валюти — найчастіший випадок. */
export function formatUsd(n: number): string {
  return `$${formatPrice(n)}`;
}

export function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatPercent(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** Знаки після коми для колонки ордербука — однакові для всіх рівнів. */
export function priceDecimals(reference: number): number {
  return decimalsFor(reference);
}
