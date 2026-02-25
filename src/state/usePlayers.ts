import { useMemo, useState } from "react";
import type { Player } from "../models/Player";
import { espnHeadshotUrl, normalizeName } from "../utils/espn";
import { findBestFuzzyNormKey } from "../utils/nameMatch";
import { useEspnIds } from "./useEspnIds";

function pickEspnHeadshotUrl(
  p: Player,
  espnIdByNormName: Record<string, string>,
  espnNormKeys: string[]
): string | undefined {
  const norm = normalizeName(p.name);

  const direct = espnIdByNormName[norm];
  if (direct) return espnHeadshotUrl(direct);

  // Fuzzy match for small naming differences (suffixes, punctuation, etc.)
  const best = findBestFuzzyNormKey({
    targetNorm: norm,
    candidateNormKeys: espnNormKeys,
  });

  if (best) {
    const id = espnIdByNormName[best.key];
    if (id) return espnHeadshotUrl(id);
  }

  // Keep any existing non-local URL (e.g., user-imported).
  if (p.imageUrl && !p.imageUrl.startsWith("/headshots/") && !p.imageUrl.includes("/headshots/")) {
    return p.imageUrl;
  }

  return undefined;
}

export function usePlayers(args: { basePlayers: Player[] }) {
  const { basePlayers } = args;

  const [extraPlayers, setExtraPlayers] = useState<Player[]>([]);

  const { espnIdByNormName } = useEspnIds();

  const espnNormKeys = useMemo(() => Object.keys(espnIdByNormName || {}), [espnIdByNormName]);

  const allPlayersArr = useMemo(() => {
    return [...basePlayers, ...extraPlayers];
  }, [basePlayers, extraPlayers]);

  const playersById = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of allPlayersArr) {
      map[p.id] = {
        ...p,
        imageUrl: pickEspnHeadshotUrl(p, espnIdByNormName, espnNormKeys),
      };
    }
    return map;
  }, [allPlayersArr, espnIdByNormName, espnNormKeys]);

  return {
    extraPlayers,
    setExtraPlayers,
    allPlayersArr,
    playersById,
  };
}
