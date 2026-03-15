import type { DraftStyle } from "../components/Board";
import type { Position, Player } from "../models/Player";
import { normalizeName } from "./espn";
import { findBestFuzzyNormKey } from "./nameMatch";

export type DraftSyncProvider = "sleeper";

export type ExternalDraftPick = {
  pickNumber: number;
  round?: number;
  rosterIndex?: number;
  playerName: string;
  playerId?: string;
  team?: string;
  position?: string;
};

export type DraftSyncPayload = {
  provider: DraftSyncProvider;
  sourceLabel: string;
  teams?: number;
  rounds?: number;
  draftStyle?: DraftStyle;
  teamNames?: string[];
  picks: ExternalDraftPick[];
};

export type DraftSyncApplied = {
  teams: number;
  rounds: number;
  draftStyle?: DraftStyle;
  teamNames?: string[];
  draftSlots: (string | null)[];
  draftedIds: Set<string>;
  draftedOrder: string[];
  unmatchedPicks: ExternalDraftPick[];
  createdPlayers: Player[];
};

type PlayerIndex = {
  byExactNormName: Map<string, Player[]>;
  byLastToken: Map<string, Player[]>;
  normKeys: string[];
};

function tokenizeNormName(value: string) {
  return normalizeName(value).split(" ").filter(Boolean);
}

function getLastToken(value: string) {
  const tokens = tokenizeNormName(value);
  return tokens[tokens.length - 1] ?? "";
}

function normalizeTeam(team: string | undefined) {
  return String(team ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .trim();
}

function normalizePosition(position: string | undefined): Position | "" {
  const normalized = String(position ?? "").toUpperCase().trim();
  if (normalized === "D/ST" || normalized === "DEF") return "DST";
  if (normalized === "PK") return "K";
  if (
    normalized === "QB" ||
    normalized === "RB" ||
    normalized === "WR" ||
    normalized === "TE" ||
    normalized === "K" ||
    normalized === "DST"
  ) {
    return normalized;
  }
  return "";
}

function createPlayerIndex(playersById: Record<string, Player>): PlayerIndex {
  const byExactNormName = new Map<string, Player[]>();
  const byLastToken = new Map<string, Player[]>();

  Object.values(playersById).forEach((player) => {
    const norm = normalizeName(player.name);
    if (!norm) return;
    const list = byExactNormName.get(norm) ?? [];
    list.push(player);
    byExactNormName.set(norm, list);

    const lastToken = getLastToken(norm);
    if (lastToken) {
      const sameLastName = byLastToken.get(lastToken) ?? [];
      sameLastName.push(player);
      byLastToken.set(lastToken, sameLastName);
    }
  });

  return {
    byExactNormName,
    byLastToken,
    normKeys: Array.from(byExactNormName.keys()),
  };
}

function scoreCandidate(player: Player, pick: ExternalDraftPick) {
  let score = 0;

  const playerTeam = normalizeTeam(player.team);
  const pickTeam = normalizeTeam(pick.team);
  if (playerTeam && pickTeam) {
    score += playerTeam === pickTeam ? 3 : -1;
  }

  const playerPos = normalizePosition(player.position);
  const pickPos = normalizePosition(pick.position);
  if (playerPos && pickPos) {
    score += playerPos === pickPos ? 2 : -2;
  }

  return score;
}

function chooseBestCandidate(candidates: Player[], pick: ExternalDraftPick) {
  let best: Player | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const score = scoreCandidate(candidate, pick);
    if (!best || score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function matchPickToPlayer(pick: ExternalDraftPick, index: PlayerIndex) {
  const normName = normalizeName(pick.playerName);
  if (!normName) return undefined;

  const exact = index.byExactNormName.get(normName);
  if (exact?.length) return chooseBestCandidate(exact, pick);

  const fuzzy = findBestFuzzyNormKey({
    targetNorm: normName,
    candidateNormKeys: index.normKeys,
    minScore: 0.88,
  });
  if (!fuzzy) return undefined;

  const fuzzyCandidates = index.byExactNormName.get(fuzzy.key);
  if (fuzzyCandidates?.length) return chooseBestCandidate(fuzzyCandidates, pick);

  const targetTokens = tokenizeNormName(normName);
  const targetLastName = targetTokens[targetTokens.length - 1] ?? "";
  const targetFirstToken = targetTokens[0] ?? "";
  const sameLastNameCandidates = targetLastName ? index.byLastToken.get(targetLastName) ?? [] : [];

  const narrowed = sameLastNameCandidates.filter((candidate) => {
    const candidateTokens = tokenizeNormName(candidate.name);
    const candidateFirstToken = candidateTokens[0] ?? "";
    if (!targetFirstToken || !candidateFirstToken) return true;
    return candidateFirstToken.startsWith(targetFirstToken) || targetFirstToken.startsWith(candidateFirstToken);
  });

  if (narrowed.length) return chooseBestCandidate(narrowed, pick);
  if (sameLastNameCandidates.length) return chooseBestCandidate(sameLastNameCandidates, pick);
  return undefined;
}

function inferRounds(picksLength: number, teams: number, requestedRounds?: number) {
  const minimum = Math.max(1, Math.ceil(Math.max(1, picksLength) / Math.max(1, teams)));
  return Math.max(minimum, requestedRounds ?? minimum);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function createPlayerFromPick(pick: ExternalDraftPick, provider: DraftSyncProvider): Player | undefined {
  const name = String(pick.playerName ?? "").trim();
  const position = normalizePosition(pick.position);
  if (!name || !position) return undefined;

  const idBase = pick.playerId?.trim()
    ? `${provider}-${pick.playerId.trim()}`
    : `${provider}-${slugify(`${name}-${pick.team ?? ""}-${position}`)}`;

  return {
    id: `synced-${idBase}`,
    name,
    position,
    team: String(pick.team ?? "").trim() || undefined,
  };
}

export function applyDraftSyncPayload(args: {
  payload: DraftSyncPayload;
  playersById: Record<string, Player>;
  fallbackTeams: number;
  fallbackRounds: number;
  fallbackTeamNames: string[];
}) {
  const { payload, playersById, fallbackTeams, fallbackRounds, fallbackTeamNames } = args;
  const index = createPlayerIndex(playersById);
  const sortedPicks = [...payload.picks]
    .filter((pick) => Number.isFinite(pick.pickNumber) && pick.pickNumber > 0 && pick.playerName.trim())
    .sort((left, right) => left.pickNumber - right.pickNumber);

  const teams = Math.max(2, Math.min(20, Math.round(payload.teams ?? fallbackTeams)));
  const rounds = Math.max(1, Math.min(40, inferRounds(sortedPicks.length, teams, payload.rounds ?? fallbackRounds)));
  const totalSlots = teams * rounds;
  const draftSlots = Array.from({ length: totalSlots }, () => null as string | null);
  const draftedIds = new Set<string>();
  const draftedOrder: string[] = [];
  const unmatchedPicks: ExternalDraftPick[] = [];
  const createdPlayers: Player[] = [];
  const createdPlayersById = new Map<string, Player>();

  sortedPicks.forEach((pick) => {
    const slotIndex = pick.pickNumber - 1;
    if (slotIndex < 0 || slotIndex >= totalSlots) return;

    const matchedPlayer = matchPickToPlayer(pick, index);
    const player = matchedPlayer ?? createPlayerFromPick(pick, payload.provider);

    if (player && !matchedPlayer && !createdPlayersById.has(player.id)) {
      createdPlayersById.set(player.id, player);
      createdPlayers.push(player);
    }

    if (!player || draftedIds.has(player.id)) {
      unmatchedPicks.push(pick);
      return;
    }

    draftSlots[slotIndex] = player.id;
    draftedIds.add(player.id);
    draftedOrder.push(player.id);
  });

  const teamNames = payload.teamNames?.length
    ? Array.from({ length: teams }, (_, index) => payload.teamNames?.[index] ?? `Team ${index + 1}`)
    : Array.from({ length: teams }, (_, index) => fallbackTeamNames[index] ?? `Team ${index + 1}`);

  return {
    teams,
    rounds,
    draftStyle: payload.draftStyle,
    teamNames,
    draftSlots,
    draftedIds,
    draftedOrder,
    unmatchedPicks,
    createdPlayers,
  } satisfies DraftSyncApplied;
}
