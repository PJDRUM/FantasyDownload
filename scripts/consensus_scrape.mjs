#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const SOURCES = {
  standard: "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
  halfPpr: "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php",
  ppr: "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
};
const OUTPUT_PATH = path.join(ROOT, "src", "data", "consensus.csv");
const BASE_PLAYERS_PATH = path.join(ROOT, "src", "data", "adp.csv");
const SAFETY_FLOOR = 200;

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);
const VALID_TEAMS = new Set([
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND",
  "JAC","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SEA",
  "SF","TB","TEN","WAS","FA"
]);

function normalizeName(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s.'’-]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeam(value) {
  const team = (value ?? "").trim().toUpperCase();
  if (team === "JAX") return "JAC";
  if (team === "WSH") return "WAS";
  return team;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value !== ""));
}

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function readBasePlayers() {
  if (!fs.existsSync(BASE_PLAYERS_PATH)) {
    throw new Error(`Could not find ${BASE_PLAYERS_PATH}. The consensus scraper uses adp.csv as its player-id registry.`);
  }

  const rows = parseCsv(fs.readFileSync(BASE_PLAYERS_PATH, "utf8"));
  const [header, ...dataRows] = rows;
  const index = Object.fromEntries(header.map((name, idx) => [name, idx]));
  const players = [];
  const byName = new Map();
  const byNamePos = new Map();
  const byNamePosTeam = new Map();

  for (const row of dataRows) {
    const player = {
      id: row[index.id],
      name: row[index.name],
      position: row[index.position],
      team: row[index.team],
    };
    if (!player.id || !player.name) continue;
    players.push(player);

    const nameKey = normalizeName(player.name);
    const positionKey = (player.position ?? "").toUpperCase();
    const teamKey = normalizeTeam(player.team);

    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(player);

    const namePosKey = `${nameKey}|${positionKey}`;
    if (!byNamePos.has(namePosKey)) byNamePos.set(namePosKey, []);
    byNamePos.get(namePosKey).push(player);

    const namePosTeamKey = `${nameKey}|${positionKey}|${teamKey}`;
    if (!byNamePosTeam.has(namePosTeamKey)) byNamePosTeam.set(namePosTeamKey, []);
    byNamePosTeam.get(namePosTeamKey).push(player);
  }

  return { players, byName, byNamePos, byNamePosTeam };
}

function chooseBestPlayer(candidates, team) {
  if (!candidates?.length) return null;
  const normalizedTeam = normalizeTeam(team);
  return candidates.find((player) => normalizeTeam(player.team) === normalizedTeam) ?? candidates[0];
}

function matchPlayer(registry, scrapedPlayer) {
  const nameKey = normalizeName(scrapedPlayer.name);
  const posKey = (scrapedPlayer.position ?? "").toUpperCase();
  const teamKey = normalizeTeam(scrapedPlayer.team);

  return (
    chooseBestPlayer(registry.byNamePosTeam.get(`${nameKey}|${posKey}|${teamKey}`), scrapedPlayer.team) ??
    chooseBestPlayer(registry.byNamePos.get(`${nameKey}|${posKey}`), scrapedPlayer.team) ??
    chooseBestPlayer(registry.byName.get(nameKey), scrapedPlayer.team)
  );
}

function fallbackId(scrapedPlayer, usedIds) {
  const slug = [
    "consensus",
    normalizeName(scrapedPlayer.name).replace(/[^a-z0-9]+/g, "-"),
    (scrapedPlayer.position || "UNK").toLowerCase(),
    (normalizeTeam(scrapedPlayer.team) || "fa").toLowerCase(),
  ]
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let candidate = slug || "consensus-player";
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function maybeTeamToken(token) {
  const cleaned = normalizeTeam(token.replace(/[^A-Z]/g, ""));
  return VALID_TEAMS.has(cleaned) ? cleaned : null;
}

function maybePositionToken(token) {
  const cleaned = token.toUpperCase().replace(/[^A-Z]/g, "");
  return VALID_POSITIONS.has(cleaned) ? cleaned : null;
}

function parseCandidate(candidate) {
  const text = (candidate.text ?? "").replace(/\s+/g, " ").trim();
  const name = (candidate.name ?? "").replace(/\s+/g, " ").trim();
  if (!text || !name) return null;

  const rankMatch = text.match(/^(\d{1,3})\b/);
  if (!rankMatch) return null;

  const rank = Number(rankMatch[1]);
  if (!Number.isFinite(rank) || rank <= 0) return null;

  const lowerText = text.toLowerCase();
  const lowerName = name.toLowerCase();
  const nameIndex = lowerText.indexOf(lowerName);
  let afterName = nameIndex >= 0 ? text.slice(nameIndex + name.length).trim() : text;
  afterName = afterName
    .replace(/\b(Q|O|IR|S|DNP|PUP)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let team = null;
  let position = null;

  const pairPatterns = [
    /\b(QB|RB|WR|TE|K|DST)\s*[-/]\s*([A-Z]{2,3}|FA)\b/i,
    /\b([A-Z]{2,3}|FA)\s*[-/]\s*(QB|RB|WR|TE|K|DST)\b/i,
    /\b(QB|RB|WR|TE|K|DST)\b\s+([A-Z]{2,3}|FA)\b/i,
    /\b([A-Z]{2,3}|FA)\b\s+(QB|RB|WR|TE|K|DST)\b/i,
  ];

  for (const pattern of pairPatterns) {
    const match = afterName.match(pattern);
    if (!match) continue;
    if (VALID_POSITIONS.has(match[1].toUpperCase())) {
      position = match[1].toUpperCase();
      team = normalizeTeam(match[2]);
    } else {
      team = normalizeTeam(match[1]);
      position = match[2].toUpperCase();
    }
    break;
  }

  if (!position || !team) {
    const tokens = afterName.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (!position) position = maybePositionToken(token);
      if (!team) team = maybeTeamToken(token);
      if (position && team) break;
    }
  }

  if (!position) {
    if (/\bDST\b/i.test(text) || /defense|special teams/i.test(text)) {
      position = "DST";
    }
  }

  if (!team && position === "DST") {
    const dstMatch = name.match(/\b(Cardinals|Falcons|Ravens|Bills|Panthers|Bears|Bengals|Browns|Cowboys|Broncos|Lions|Packers|Texans|Colts|Jaguars|Chiefs|Chargers|Rams|Raiders|Dolphins|Vikings|Patriots|Saints|Giants|Jets|Eagles|Steelers|49ers|Seahawks|Buccaneers|Titans|Commanders)\b/i);
    const teamMap = {
      Cardinals: "ARI", Falcons: "ATL", Ravens: "BAL", Bills: "BUF", Panthers: "CAR", Bears: "CHI",
      Bengals: "CIN", Browns: "CLE", Cowboys: "DAL", Broncos: "DEN", Lions: "DET", Packers: "GB",
      Texans: "HOU", Colts: "IND", Jaguars: "JAC", Chiefs: "KC", Chargers: "LAC", Rams: "LAR",
      Raiders: "LV", Dolphins: "MIA", Vikings: "MIN", Patriots: "NE", Saints: "NO", Giants: "NYG",
      Jets: "NYJ", Eagles: "PHI", Steelers: "PIT", "49ers": "SF", Seahawks: "SEA", Buccaneers: "TB",
      Titans: "TEN", Commanders: "WAS",
    };
    if (dstMatch) team = teamMap[dstMatch[1]];
  }

  if (!position) return null;
  team = normalizeTeam(team || "FA");

  return { rank, name, position, team };
}

async function extractCandidates(page) {
  return page.evaluate(() => {
    const items = [];
    const seen = new Set();

    function add(text, name) {
      const cleanText = (text || "").replace(/\s+/g, " ").trim();
      const cleanName = (name || "").replace(/\s+/g, " ").trim();
      if (!cleanText || !cleanName) return;
      const key = `${cleanName}|||${cleanText}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ name: cleanName, text: cleanText });
    }

    const playerLinkSelector = 'a[href*="/nfl/players/"]';
    const playerLinks = Array.from(document.querySelectorAll(playerLinkSelector));

    for (const link of playerLinks) {
      const name = link.textContent?.trim() || "";
      const containers = [
        link.closest("tr"),
        link.closest('[role="row"]'),
        link.closest("li"),
        link.closest("article"),
        link.closest("section"),
        link.parentElement,
      ].filter(Boolean);

      for (const container of containers) {
        add(container.innerText || "", name);
      }
    }

    const bodyLines = (document.body.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (let idx = 0; idx < bodyLines.length; idx += 1) {
      const line = bodyLines[idx];
      const rankMatch = line.match(/^(\d{1,3})\b/);
      if (!rankMatch) continue;

      for (let lookahead = 0; lookahead <= 2; lookahead += 1) {
        const maybeLine = bodyLines[idx + lookahead] || "";
        const maybeNameMatch = maybeLine.match(/^\d{1,3}\.?\s+(.+?)\s+([A-Z]{2,3}|FA)\s+(QB|RB|WR|TE|K|DST)\b/i);
        if (maybeNameMatch) {
          add(maybeLine, maybeNameMatch[1]);
        }
      }
    }

    return items;
  });
}

async function fetchConsensusRows(browser, url, label) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(350);
  }

  const candidates = await extractCandidates(page);
  await page.close();

  const rows = [];
  const byName = new Map();

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (!parsed) continue;

    const existing = byName.get(normalizeName(parsed.name));
    if (!existing || parsed.rank < existing.rank) {
      byName.set(normalizeName(parsed.name), parsed);
    }
  }

  for (const value of byName.values()) {
    rows.push(value);
  }

  rows.sort((a, b) => a.rank - b.rank);

  console.log(`[${label}] fetched ${rows.length} rows`);
  if (rows.length < SAFETY_FLOOR) {
    throw new Error(
      `${label} returned only ${rows.length} rows, below the safety floor of ${SAFETY_FLOOR}. Aborting so the existing consensus.csv does not get wiped out.`
    );
  }

  return rows;
}

function writeConsensusCsv(records) {
  const header = [
    "id",
    "name",
    "position",
    "team",
    "consensusStandard",
    "consensusHalfPpr",
    "consensusPpr",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const record of records) {
    lines.push(
      [
        record.id,
        record.name,
        record.position,
        record.team,
        record.consensusStandard ?? "",
        record.consensusHalfPpr ?? "",
        record.consensusPpr ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const registry = readBasePlayers();
  const usedIds = new Set(registry.players.map((player) => player.id));
  const browser = await chromium.launch({ headless: true });

  try {
    const scraped = {};
    for (const [label, url] of Object.entries(SOURCES)) {
      scraped[label] = await fetchConsensusRows(browser, url, label);
    }

    const combined = new Map();
    let createdFallbackPlayers = 0;
    const fallbackExamples = [];

    for (const [label, rows] of Object.entries(scraped)) {
      for (const row of rows) {
        const matched = matchPlayer(registry, row);
        const player = matched ?? {
          id: fallbackId(row, usedIds),
          name: row.name,
          position: row.position,
          team: row.team,
        };

        if (!matched) {
          usedIds.add(player.id);
          createdFallbackPlayers += 1;
          if (fallbackExamples.length < 10) {
            fallbackExamples.push(`${player.name} (${player.position}, ${player.team})`);
          }
        }

        const existing = combined.get(player.id) ?? {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          consensusStandard: "",
          consensusHalfPpr: "",
          consensusPpr: "",
        };

        if (!existing.team || existing.team === "FA") {
          existing.team = player.team;
        }

        if (label === "standard") existing.consensusStandard = row.rank;
        if (label === "halfPpr") existing.consensusHalfPpr = row.rank;
        if (label === "ppr") existing.consensusPpr = row.rank;

        combined.set(player.id, existing);
      }
    }

    const records = Array.from(combined.values()).sort((a, b) => {
      const rankA = Number(a.consensusHalfPpr || a.consensusPpr || a.consensusStandard || 9999);
      const rankB = Number(b.consensusHalfPpr || b.consensusPpr || b.consensusStandard || 9999);
      return rankA - rankB;
    });

    writeConsensusCsv(records);
    console.log(`Wrote ${records.length} players to src/data/consensus.csv`);

    if (createdFallbackPlayers > 0) {
      console.log(
        `Created fallback records for ${createdFallbackPlayers} unmatched players. Examples: ${fallbackExamples.join(", ")}`
      );
    } else {
      console.log("Matched every scraped consensus player to an existing player record.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
