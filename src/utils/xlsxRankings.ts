// src/utils/xlsxRankings.ts
import type { Player, Position } from "../models/Player";
import * as XLSX from "xlsx";

export type TiersByPos = Record<Position, string[]>;
// tiersByPos[pos] = ordered list of playerIds that START a new tier (Tier 2+), within that position ranking order.

// List tabs (and XLSX sheet name for the primary rankings sheet).
export const RANKINGS_LIST_KEYS = ["Rankings", "ADP"] as const;
export type RankingsListKey = (typeof RANKINGS_LIST_KEYS)[number];

export function emptyTiersByPos(): TiersByPos {
  return { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] };
}

function cleanStr(v: unknown): string {
  return String(v ?? "").trim();
}

function csvEscape(v: string): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    if (ch === "\r") continue;

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((c) => cleanStr(c) === "")) rows.pop();
  return rows;
}

function safePos(v: unknown): Position | null {
  const raw = String(v ?? "").trim().toUpperCase();
  if (raw === "QB" || raw === "RB" || raw === "WR" || raw === "TE") return raw as Position;

  // Kickers
  if (raw === "K" || raw === "PK" || raw === "KICKER" || raw === "KICKERS") return "K";

  // Defense / Special Teams
  if (
    raw === "DST" ||
    raw === "D/ST" ||
    raw === "D-ST" ||
    raw === "DEF" ||
    raw === "D" ||
    raw === "DEFENSE" ||
    raw === "DEFENCE"
  )
    return "DST";

  return null;
}

function normalizeTierBreaks(pos: Position, breaks: string[]): string[] {
  const cleaned = (breaks ?? []).map((x) => cleanStr(x)).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of cleaned) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function slugifyId(name: string) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueId(baseId: string, taken: Set<string>) {
  const base = baseId || "player";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function computePosTierNumberById(args: {
  rankingIds: string[];
  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
}): Record<string, number> {
  const { rankingIds, playersById, tiersByPos } = args;

  const posLists: Record<Position, string[]> = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] };
  for (const id of rankingIds) {
    const p = playersById[id];
    if (!p) continue;
    posLists[p.position].push(id);
  }

  const tierNumById: Record<string, number> = {};
  (["QB", "RB", "WR", "TE", "K", "DST"] as Position[]).forEach((pos) => {
    const ids = posLists[pos];
    const breaks = normalizeTierBreaks(pos, tiersByPos[pos] ?? []);
    const breakSet = new Set(breaks);

    let tier = 1;
    for (const id of ids) {
      if (breakSet.has(id)) tier += 1;
      tierNumById[id] = tier;
    }
  });

  return tierNumById;
}


export function exportRankingsCsv(args: {
  rankingIds: string[];
  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;}): string {
  const { rankingIds, playersById, tiersByPos } = args;

  const posTierNumById = computePosTierNumberById({ rankingIds, playersById, tiersByPos });
  const header = ["rank", "id", "name", "position", "team", "age", "adp", "tier", "risk", "upside"];
  const lines: string[] = [header.join(",")];

  for (let i = 0; i < rankingIds.length; i++) {
    const id = rankingIds[i];
    const p = playersById[id];
    if (!p) continue;

    const row = [
      String(i + 1),
      p.id,
      p.name,
      p.position,
      p.team ?? "",
      p.age == null ? "" : String(p.age),
      p.adp == null ? "" : String(p.adp),
      String(posTierNumById[p.id] ?? 1),
      p.risk == null ? "" : String(p.risk),
      p.upside == null ? "" : String(p.upside),
    ].map(csvEscape);

    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function importRankingsCsv(
  args: {
    csvText: string;
    // Sorting strategy for the imported overall list.
    // - "rank": use the rank column if present (default; keeps Rankings behavior)
    // - "adp": sort by ADP ascending if present (used for the ADP sheet)
    // - "none": preserve file/row order
    sortBy?: "rank" | "adp" | "none";
  }
): {
  rankingIds: string[];
  tiersByPos: TiersByPos;  players: Player[];
  hasAnyAdp: boolean;
} {
  const { csvText, sortBy = "rank" } = args;

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { rankingIds: [], tiersByPos: emptyTiersByPos(), players: [], hasAnyAdp: false };
  }

  const header = rows[0].map((h) => cleanStr(h).toLowerCase());

  // Prefer an explicit "rank" column, but if the sheet has a blank header in column A,
  // treat the first column as rank if it looks like a rank column.
  const idxRankExplicit = header.findIndex(
    (h) =>
      h === "rank" ||
      h === "#" ||
      h === "overall rank" ||
      h === "overall_rank" ||
      h === "ovr" ||
      h === "overall" ||
      h === "rnk"
  );
  const idxRank = idxRankExplicit >= 0 ? idxRankExplicit : 0;

  const idxId = header.findIndex((h) => h === "id" || h === "playerid" || h === "player_id");
  const idxName = header.findIndex((h) => h === "name" || h === "player_name" || h === "full_name");
  const idxPos = header.findIndex((h) => h === "position" || h === "pos");
  const idxTeam = header.findIndex((h) => h === "team" || h === "tm" || h === "nfl_team" || h === "nfl team");
  const idxAge = header.findIndex((h) => h === "age" || h === "player_age" || h === "player age");
  const idxAdp = header.findIndex(
    (h) =>
      h === "adp" ||
      h === "avg_adp" ||
      h === "average_draft_position" ||
      h === "average draft position" ||
      h === "average draft" ||
      h === "avg draft position"
  );
  const idxTier = header.findIndex((h) => h === "tier" || h === "pos_tier" || h === "postier" || h === "position_tier" || h === "position tier" || h === "pos tier");  const idxRisk = header.findIndex((h) => h === "risk" || h === "risk_score" || h === "risk score" || h === "riskscore");
  const idxUpside = header.findIndex((h) => h === "upside" || h === "upside_score" || h === "upside score" || h === "upsidescore");

  function parseRank(raw: unknown): number | undefined {
    let s = cleanStr(raw);
    if (!s) return undefined;

    // Common placeholders
    if (/^(?:-|—|n\/a|na|null|undefined)$/i.test(s.trim())) return undefined;

    // Keep digits only
    s = s.replace(/,/g, "").replace(/[^0-9]/g, "").trim();
    if (!s) return undefined;

    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    if (n <= 0) return undefined;
    return Math.floor(n);
  }

  function parseTier(raw: unknown): number | undefined {
    let s = cleanStr(raw);
    if (!s) return undefined;

    // Common placeholders
    if (/^(?:-|—|n\/a|na|null|undefined)$/i.test(s.trim())) return undefined;

    // Extract first integer found (supports inputs like "Tier 2", "T3", "2 (elite)")
    const mm = s.match(/\d+/);
    if (!mm) return undefined;

    const n = Number(mm[0]);
    if (!Number.isFinite(n)) return undefined;
    if (n <= 0) return undefined;
    return Math.floor(n);
  }


  
  function parseAge(raw: unknown): number | undefined {
    let s = cleanStr(raw);
    if (!s) return undefined;
    if (/^(?:-|—|n\/a|na|null|undefined)$/i.test(s.trim())) return undefined;
    s = s.replace(/,/g, "").trim();
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  }

  function parseAdp(raw: unknown): number | undefined {
    let s = cleanStr(raw);
    if (!s) return undefined;

    // Common placeholders
    if (/^(?:-|—|n\/a|na|null|undefined)$/i.test(s.trim())) return undefined;

    // Remove commas and non-numeric adornments (keep digits + dot)
    s = s.replace(/,/g, "").replace(/[^0-9.]/g, "").trim();
    if (!s) return undefined;

    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    if (n < 0) return 0;
    return n;
  }

  function parseScore(raw: unknown): number | undefined {
    let s = cleanStr(raw);
    if (!s) return undefined;

    // Allow inputs like "72%" or "7.2 / 10"
    s = s.replace(/%/g, "").replace(/\s*\/\s*10\s*$/i, "").trim();
    if (!s) return undefined;

    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;

    // Normalize to 0–10 (decimals allowed):
    // - 0–1   => treat as 0–10 (probability-like)
    // - >10   => treat as 0–100 (percent-like)
    // - else  => already 0–10
    let v = n;
    if (v >= 0 && v < 1) v = v * 10;
    else if (v > 10) v = v / 10;

    // Clamp to a sane range
    if (v < 0) return 0;
    if (v > 10) return 10;
    return v;
  }

  if (idxId < 0 && idxName < 0) {
    throw new Error("CSV must include at least an 'id' or 'name' column.");
  }
  if (idxPos < 0) {
    throw new Error("CSV must include a 'position' (or 'pos') column.");
  }

  const rankingIdsRaw: string[] = [];
  const rankByIdFromFile: Record<string, number> = {};
  const adpByIdFromFile: Record<string, number> = {};
  const firstSeenIndexById: Record<string, number> = {};

  const posTierByIdFromFile: Record<string, number> = {};  const playersById: Record<string, Player> = {};

  const taken = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const name = idxName >= 0 ? cleanStr(r[idxName]) : "";
    const pos = safePos(idxPos >= 0 ? r[idxPos] : "");
    if (!pos) continue;

    let id = idxId >= 0 ? cleanStr(r[idxId]) : "";
    if (!id) {
      id = ensureUniqueId(slugifyId(name), taken);
    } else {
      id = ensureUniqueId(id, taken);
    }

    taken.add(id);

    if (!playersById[id]) {
      playersById[id] = {
        id,
        name: name || id,
        position: pos,
        imageUrl: "",
      };
    }

    const risk = idxRisk >= 0 ? parseScore(r[idxRisk]) : undefined;
    const upside = idxUpside >= 0 ? parseScore(r[idxUpside]) : undefined;
    const adp = idxAdp >= 0 ? parseAdp(r[idxAdp]) : undefined;
    const team = idxTeam >= 0 ? cleanStr(r[idxTeam]) : "";
    const age = idxAge >= 0 ? parseAge(r[idxAge]) : undefined;
    if (risk != null) playersById[id].risk = risk;
    if (upside != null) playersById[id].upside = upside;
    if (team) playersById[id].team = team;
    if (age != null) playersById[id].age = age;
    if (adp != null) {
      playersById[id].adp = adp;
      adpByIdFromFile[id] = adp;
    }

    rankingIdsRaw.push(id);
    if (firstSeenIndexById[id] == null) firstSeenIndexById[id] = rankingIdsRaw.length - 1;

    // Rank: prefer explicit "rank" column if present; otherwise treat column A as rank.
    if (idxRank >= 0 && idxRank < r.length) {
      const rk = parseRank(r[idxRank]);
      if (rk != null) rankByIdFromFile[id] = rk;
    }

    const posTierNum = idxTier >= 0 ? (parseTier(r[idxTier]) ?? 1) : 1;
    posTierByIdFromFile[id] = Number.isFinite(posTierNum) && posTierNum >= 1 ? posTierNum : 1;  }

  // de-dupe preserve order (for stable tie-breaking)
  const rankingIds: string[] = [];
  const seen = new Set<string>();
  for (const id of rankingIdsRaw) {
    if (seen.has(id)) continue;
    seen.add(id);
    rankingIds.push(id);
  }


  const hasAnyRank = Object.keys(rankByIdFromFile).length > 0;
  const hasAnyAdp = Object.keys(adpByIdFromFile).length > 0;

  // Order the imported rankingIds based on the requested strategy.
  // NOTE: Tier breaks are rebuilt *after* this ordering.
  if (sortBy !== "none") {
    if (sortBy === "adp" && hasAnyAdp) {
      rankingIds.sort((a, b) => {
        const aa = adpByIdFromFile[a];
        const bb = adpByIdFromFile[b];

        const aHas = typeof aa === "number";
        const bHas = typeof bb === "number";

        if (aHas && bHas) {
          if (aa !== bb) return aa - bb;
        } else if (aHas && !bHas) {
          return -1;
        } else if (!aHas && bHas) {
          return 1;
        }

        // Stable fallback: original (first-seen) order
        return (firstSeenIndexById[a] ?? 0) - (firstSeenIndexById[b] ?? 0);
      });
    } else if (hasAnyRank) {
      // Default / Rankings behavior: sort by rank if present.
      rankingIds.sort((a, b) => {
        const ra = rankByIdFromFile[a];
        const rb = rankByIdFromFile[b];

        const aHas = typeof ra === "number";
        const bHas = typeof rb === "number";

        if (aHas && bHas) {
          if (ra !== rb) return ra - rb;
        } else if (aHas && !bHas) {
          return -1;
        } else if (!aHas && bHas) {
          return 1;
        }

        // Stable fallback: original (first-seen) order
        return (firstSeenIndexById[a] ?? 0) - (firstSeenIndexById[b] ?? 0);
      });
    }
  }


  // rebuild position tier breaks from tier numbers
  const tiersByPos: TiersByPos = emptyTiersByPos();
  (["QB", "RB", "WR", "TE", "K", "DST"] as Position[]).forEach((pos) => {
    const posIds = rankingIds.filter((id) => playersById[id]?.position === pos);
    let lastTier = 1;

    for (const id of posIds) {
      const t = posTierByIdFromFile[id] ?? 1;
      if (t > lastTier) {
        tiersByPos[pos].push(id);
        lastTier = t;
      } else {
        lastTier = t;
      }
    }

    tiersByPos[pos] = normalizeTierBreaks(pos, tiersByPos[pos]);
  });
  return { rankingIds, tiersByPos, players: Object.values(playersById), hasAnyAdp };
}

// ---------- XLSX multi-sheet import/export (Rankings/ADP) ----------

export type RankingsListsState<T> = Record<RankingsListKey, T>;

export function emptyRankingIdsByList(initial: string[] = []): RankingsListsState<string[]> {
  return {
    Rankings: [...initial],
    ADP: [...initial],
  };
}

export function emptyTiersByPosByList(): RankingsListsState<TiersByPos> {
  return {
    Rankings: emptyTiersByPos(),
    ADP: emptyTiersByPos(),
  };
}

function sheetToCsvText(ws: XLSX.WorkSheet): string {
  // Use sheet_to_csv to preserve a stable import format (same as CSV import).
  return XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\n" });
}

function csvTextToAoa(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    if (ch === "\r") continue;

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((c) => !String(c ?? "").trim())) rows.pop();
  return rows;
}

export function exportRankingsXlsx(args: {
  rankingIdsByList: RankingsListsState<string[]>;
  playersById: Record<string, Player>;
  tiersByPosByList: RankingsListsState<TiersByPos>;}): ArrayBuffer {
  const { rankingIdsByList, playersById, tiersByPosByList } = args;

  // Export a SINGLE sheet (Rankings). ADP ordering is derived on import from the ADP column.
  const wb = XLSX.utils.book_new();

  const rankingIds = rankingIdsByList["Rankings"] ?? [];
  const tiersByPos = tiersByPosByList["Rankings"] ?? emptyTiersByPos();
  const csv = exportRankingsCsv({
    rankingIds,
    playersById,
    tiersByPos,  });

  const ws = XLSX.utils.aoa_to_sheet(csvTextToAoa(csv));
  XLSX.utils.book_append_sheet(wb, ws, "Rankings");

  // xlsx write returns ArrayBuffer when type="array"
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return out;
}

export function importRankingsXlsx(args: {
  xlsxArrayBuffer: ArrayBuffer;
}): {
  rankingIdsByList: Partial<RankingsListsState<string[]>>;
  tiersByPosByList: Partial<RankingsListsState<TiersByPos>>;  players: Player[];
} {
  const { xlsxArrayBuffer } = args;

  const wb = XLSX.read(xlsxArrayBuffer, { type: "array" });

  // Import from a SINGLE sheet (Rankings). We derive:
  // - Rankings ordering from the "rank" column (or row order / first column fallback)
  // - ADP ordering from the "adp" column
  const rankingsSheetName = wb.Sheets["Rankings"]
    ? "Rankings"
    : wb.Sheets["UDK"]
      ? "UDK"
      : wb.SheetNames?.[0];
  if (!rankingsSheetName) {
    return {
      rankingIdsByList: {},
      tiersByPosByList: {},      players: [],
    };
  }

  const ws = wb.Sheets[rankingsSheetName];
  const csvText = sheetToCsvText(ws);

  // Primary import: Rankings list (tiers / overall tier breaks live here)
  const parsedRankings = importRankingsCsv({ csvText, sortBy: "rank" });

  // Derived import: ADP list (ordering only; tiers/breaks are cleared to avoid mismatched tier metadata)
  const parsedADP = importRankingsCsv({ csvText, sortBy: "adp" });

  const rankingIdsByList: Partial<RankingsListsState<string[]>> = {
    Rankings: parsedRankings.rankingIds,
    ...(parsedADP.hasAnyAdp ? { ADP: parsedADP.rankingIds } : {}),
  };

  const tiersByPosByList: Partial<RankingsListsState<TiersByPos>> = {
    Rankings: parsedRankings.tiersByPos,
    // Only import ADP tiers if ADP data exists; otherwise keep existing ADP list/tiers unchanged.
    ...(parsedADP.hasAnyAdp ? { ADP: parsedADP.tiersByPos } : {}),
  };
  const playersById: Record<string, Player> = {};
  for (const p of [...parsedRankings.players, ...parsedADP.players]) {
    if (!playersById[p.id]) playersById[p.id] = p;
  }

  return {
    rankingIdsByList,
    tiersByPosByList,    players: Object.values(playersById),
  };
}