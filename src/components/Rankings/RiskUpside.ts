export function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Returns true only if the raw value is actually present in the data.
 * - undefined/null/NaN => false
 * - numbers (including 0) => true
 */
export function hasScore(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isFinite(raw);
}

/**
 * Converts a 0–10 score into a 0–100 percentage.
 * Back-compat: if legacy data stored 0–100, treat it as a pct already.
 */
export function score10ToPct(raw: number | undefined): number {
  if (!hasScore(raw)) return 0;

  if (raw > 10.5) return clampPct(raw);

  const v10 = Math.max(0, Math.min(10, raw));
  return clampPct((v10 / 10) * 100);
}
