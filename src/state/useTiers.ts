import { useState } from "react";
import type { Player, Position } from "../models/Player";
import type { TiersByPos } from "../utils/xlsxRankings";
import { emptyTiersByPos } from "../utils/xlsxRankings";

export function useTiers(args: {
  rankingIds: string[];
  playersById: Record<string, Player>;
}) {
  const { rankingIds, playersById } = args;

  const [tiersByPos, setTiersByPos] = useState<TiersByPos>(emptyTiersByPos());
  function normalizePosTierBreaks(pos: Position, breaks: string[]) {
    const posIds = rankingIds.filter((id) => playersById[id]?.position === pos);
    const posSet = new Set(posIds);

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of breaks) {
      if (!posSet.has(id)) continue;
      if (posIds.indexOf(id) <= 0) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }

    unique.sort((a, b) => posIds.indexOf(a) - posIds.indexOf(b));
    return unique;
  }

  function addTier(pos: Position) {
    const posIds = rankingIds.filter((id) => playersById[id]?.position === pos);
    if (posIds.length === 0) return;

    setTiersByPos((prev) => {
      const current = normalizePosTierBreaks(pos, prev[pos] ?? []);

      let nextStart: string;
      if (current.length === 0) {
        nextStart = posIds[Math.min(1, posIds.length - 1)];
      } else {
        const lastStartId = current[current.length - 1];
        const lastIdx = posIds.indexOf(lastStartId);
        const nextIdx = Math.min(lastIdx + 1, posIds.length - 1);
        nextStart = posIds[nextIdx];
      }

      const nextBreaks = normalizePosTierBreaks(pos, [...current, nextStart]);
      return { ...prev, [pos]: nextBreaks };
    });
  }

  function removeLastTier(pos: Position) {
    setTiersByPos((prev) => {
      const current = normalizePosTierBreaks(pos, prev[pos] ?? []);
      if (current.length === 0) return prev;
      return { ...prev, [pos]: current.slice(0, -1) };
    });
  }

  function moveTierBreak(pos: Position, fromStartId: string, toStartId: string) {
    setTiersByPos((prev) => {
      const current = normalizePosTierBreaks(pos, prev[pos] ?? []);
      const next = current.filter((id) => id !== fromStartId);
      next.push(toStartId);
      return { ...prev, [pos]: normalizePosTierBreaks(pos, next) };
    });
  }

  return {
    tiersByPos,
    setTiersByPos,
    addTier,
    removeLastTier,
    moveTierBreak,  };
}
