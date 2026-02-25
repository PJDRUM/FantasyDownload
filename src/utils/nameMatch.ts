// src/utils/nameMatch.ts
import { normalizeName } from "./espn";

/**
 * Jaro-Winkler similarity in [0, 1]. Higher means more similar.
 * Small, dependency-free implementation for fuzzy player-name matching.
 */
export function jaroWinkler(aRaw: string, bRaw: string): number {
  const a = normalizeName(aRaw);
  const b = normalizeName(bRaw);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aLen = a.length;
  const bLen = b.length;

  const matchDistance = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);

  const aMatches = new Array<boolean>(aLen).fill(false);
  const bMatches = new Array<boolean>(bLen).fill(false);

  let matches = 0;

  for (let i = 0; i < aLen; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bLen);

    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // transpositions
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (k < bLen && !bMatches[k]) k++;
    if (k < bLen && a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const m = matches;
  const jaro = (m / aLen + m / bLen + (m - transpositions) / m) / 3;

  // Winkler prefix boost (up to 4 chars)
  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, aLen, bLen); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  const p = 0.1;
  return jaro + prefix * p * (1 - jaro);
}

function lastToken(norm: string): string {
  const parts = norm.split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/**
 * Find the best fuzzy match among normalized candidate keys.
 *
 * Guard rails:
 * - Prefer candidates sharing the same last token (last name) when available.
 * - Require the match score to be above a configurable threshold.
 */
export function findBestFuzzyNormKey(args: {
  targetNorm: string;
  candidateNormKeys: string[];
  minScore?: number;
}): { key: string; score: number } | undefined {
  const { targetNorm, candidateNormKeys, minScore = 0.92 } = args;
  const target = normalizeName(targetNorm);
  if (!target) return undefined;

  const targetLast = lastToken(target);

  let bestKey = "";
  let bestScore = 0;

  for (const candNormKey of candidateNormKeys) {
    if (!candNormKey) continue;

    // If we have last names, require they match to prevent bad headshots.
    if (targetLast) {
      const candLast = lastToken(candNormKey);
      if (candLast && candLast !== targetLast) continue;
    }

    const score = jaroWinkler(target, candNormKey);
    if (score > bestScore) {
      bestScore = score;
      bestKey = candNormKey;
    }
  }

  if (!bestKey || bestScore < minScore) return undefined;
  return { key: bestKey, score: bestScore };
}
