// src/components/Rankings/searchUtils.ts
import type { Player, Position } from "../../models/Player";

/**
 * Normalizes strings for reliable, forgiving search:
 * - lowercases
 * - strips punctuation commonly found in names (., apostrophes, etc.)
 * - turns dashes/underscores into spaces
 * - collapses whitespace
 *
 * Note: diacritic removal is attempted when supported by the runtime.
 */
export function normalizeForSearch(s: string) {
  let out = String(s || "").toLowerCase();

  // Attempt to remove diacritics (e.g., "José" -> "jose") when supported.
  try {
    out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    // ignore
  }

  return out
    // common punctuation in player names
    .replace(/[.'’`]/g, "")
    // treat separators as spaces
    .replace(/[-_/]/g, " ")
    // remove any remaining non-word chars except spaces
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(s: string) {
  return s.replace(/\s+/g, "");
}

function matchesText(normText: string, normQuery: string) {
  if (!normQuery) return true;

  const qTerms = normQuery.split(" ").filter(Boolean);
  if (qTerms.length === 0) return true;

  // Multi-term queries: AND-match terms in order-agnostic way.
  // Single-term queries: allow "compact" match so "amonra" matches "amon ra".
  if (qTerms.length === 1) {
    const q = qTerms[0];
    return normText.includes(q) || compact(normText).includes(compact(q));
  }

  const textCompact = compact(normText);
  return qTerms.every((term) => normText.includes(term) || textCompact.includes(compact(term)));
}

export function playerMatchesQuery(p: Player, normQuery: string) {
  const q = normalizeForSearch(normQuery);
  if (!q) return true;

  const nameN = normalizeForSearch(p.name);
  const teamN = normalizeForSearch(p.team || "");
  const posN = normalizeForSearch(p.position);

  return matchesText(nameN, q) || (teamN ? matchesText(teamN, q) : false) || matchesText(posN, q);
}

export type SearchMatch = {
  id: string;
  name: string;
  pos: Position;
  rankLabel: string;
};

export function buildSearchMatches(args: {
  query: string;
  idsForTab: string[];
  playersById: Record<string, Player>;
  isOverall: boolean;
  rankingIds: string[]; // full overall ordering (for overall rank label)
  limit?: number;
}): SearchMatch[] {
  const { query, idsForTab, playersById, isOverall, rankingIds, limit = 12 } = args;

  const q = normalizeForSearch(query);
  if (!q) return [];

  const out: SearchMatch[] = [];

  for (let i = 0; i < idsForTab.length; i++) {
    const id = idsForTab[i];
    const p = playersById[id];
    if (!p) continue;

    if (!playerMatchesQuery(p, q)) continue;

    const rankLabel = isOverall ? String(rankingIds.indexOf(id) + 1) : String(i + 1);

    out.push({ id, name: p.name, pos: p.position, rankLabel });
    if (out.length >= limit) break;
  }

  return out;
}

// Compatibility exports used by RankingsList
export function normalizeQuery(q: string) {
  return normalizeForSearch(q);
}

export function filterPlayersByQuery<T extends { p: Player }>(candidates: T[], normQuery: string): T[] {
  const q = normalizeForSearch(normQuery);
  if (!q) return [];
  return candidates.filter((c) => playerMatchesQuery(c.p, q));
}
