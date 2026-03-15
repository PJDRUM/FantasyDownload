import type { DraftSyncPayload } from "./draftSync";

export type SleeperConfig = {
  identifier: string;
};

export type DraftSyncRequest = {
  provider: "sleeper";
  config: SleeperConfig;
};

export const DRAFT_SYNC_STORAGE_KEY = "fantasy-board:draft-sync:v1";

const SLEEPER_PLAYERS_CACHE_KEY = "fantasy-board:sleeper-players:v1";
const SLEEPER_PLAYERS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function parseNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildPlayerName(firstName: unknown, lastName: unknown, fallback: unknown) {
  const joined = `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
  return joined || String(fallback ?? "").trim();
}

async function fetchJsonOrThrow(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with HTTP ${response.status}`);
  }
  return response.json();
}

function withCacheBust(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_t=${Date.now()}`;
}

async function getSleeperPlayersIndex() {
  if (typeof window === "undefined") return {};

  const cached = safeJsonParse<{ savedAt?: number; players?: Record<string, any> }>(
    window.localStorage.getItem(SLEEPER_PLAYERS_CACHE_KEY),
    {}
  );

  if (
    cached.savedAt &&
    Date.now() - cached.savedAt < SLEEPER_PLAYERS_CACHE_MAX_AGE_MS &&
    cached.players &&
    typeof cached.players === "object"
  ) {
    return cached.players;
  }

  const response = await fetchJsonOrThrow("https://api.sleeper.app/v1/players/nfl");
  const players = response && typeof response === "object" ? response : {};

  try {
    window.localStorage.setItem(
      SLEEPER_PLAYERS_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        players,
      })
    );
  } catch {}

  return players;
}

function parseSleeperIdentifier(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  const fromUrl = trimmed.match(/\/(draft|league)\/(?:nfl\/)?([0-9]+)/i) ?? trimmed.match(/([0-9]{6,})/);
  return fromUrl?.[2] ?? fromUrl?.[1] ?? trimmed;
}

export async function loadDraftSyncRequest(request: DraftSyncRequest): Promise<DraftSyncPayload> {
  const identifier = parseSleeperIdentifier(request.config.identifier);
  if (!identifier) throw new Error("Enter a Sleeper draft ID or league ID.");

  let draft = await fetchJsonOrThrow(
    withCacheBust(`https://api.sleeper.app/v1/draft/${encodeURIComponent(identifier)}`)
  ).catch(() => null);

  if (!draft) {
    const league = await fetchJsonOrThrow(
      withCacheBust(`https://api.sleeper.app/v1/league/${encodeURIComponent(identifier)}`)
    );
    const draftId = String(league?.draft_id ?? "").trim();
    if (!draftId) throw new Error("This Sleeper league does not expose a draft ID.");
    draft = await fetchJsonOrThrow(
      withCacheBust(`https://api.sleeper.app/v1/draft/${encodeURIComponent(draftId)}`)
    );
  }

  const picksResponse = await fetchJsonOrThrow(
    withCacheBust(
      `https://api.sleeper.app/v1/draft/${encodeURIComponent(String(draft.draft_id ?? identifier))}/picks`
    )
  );
  const picks = Array.isArray(picksResponse) ? picksResponse : [];
  const sleeperPlayersById = picks.length ? await getSleeperPlayersIndex() : {};

  const teamCount =
    parseNumber(draft?.settings?.teams) ??
    parseNumber(draft?.settings?.teams_num) ??
    parseNumber(draft?.metadata?.teams) ??
    parseNumber(draft?.draft_order && Object.keys(draft.draft_order).length);

  const rounds = parseNumber(draft?.settings?.rounds);

  return {
    provider: "sleeper",
    sourceLabel: `Sleeper ${draft?.metadata?.name ? `• ${draft.metadata.name}` : `• ${draft?.draft_id ?? identifier}`}`,
    teams: teamCount,
    rounds,
    draftStyle: draft?.type === "snake" ? "Snake Draft" : undefined,
    picks: picks.map((pick: any) => {
      const sleeperPlayer = sleeperPlayersById[String(pick?.player_id ?? "")] ?? {};
      return {
        pickNumber: parseNumber(pick?.pick_no) ?? 0,
        round: parseNumber(pick?.round),
        rosterIndex: parseNumber(pick?.draft_slot),
        playerName: buildPlayerName(
          sleeperPlayer?.first_name ?? pick?.metadata?.first_name,
          sleeperPlayer?.last_name ?? pick?.metadata?.last_name,
          sleeperPlayer?.full_name ?? pick?.metadata?.player_name
        ),
        playerId: String(pick?.player_id ?? ""),
        team: String(sleeperPlayer?.team ?? sleeperPlayer?.team_abbr ?? pick?.metadata?.team ?? ""),
        position: String(sleeperPlayer?.position ?? pick?.metadata?.position ?? ""),
      };
    }),
  };
}
