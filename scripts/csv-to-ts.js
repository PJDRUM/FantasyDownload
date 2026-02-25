const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "..", "src", "data", "rankings.csv");
const raw = fs.readFileSync(csvPath, "utf8");

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const lines = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

// remove header if present
if (lines[0].toLowerCase().startsWith("name")) {
  lines.shift();
}

const players = [];
const rankingIds = [];
const seen = new Map();

for (const line of lines) {
  const [nameRaw, posRaw] = line.split(",");
  if (!nameRaw || !posRaw) continue;

  let id = slugify(nameRaw);
  let suffix = 2;
  while (seen.has(id)) {
    id = `${id}-${suffix++}`;
  }
  seen.set(id, true);

  const position = ["QB", "RB", "WR", "TE"].includes(posRaw.trim().toUpperCase())
    ? posRaw.trim().toUpperCase()
    : "WR";

  players.push({
    id,
    name: nameRaw.trim(),
    position,
    imageUrl: "",
  });

  rankingIds.push(id);
}

const output = `import { Player } from "../models/Player";

export const players: Player[] = ${JSON.stringify(players, null, 2)};

export const rankingIds: string[] = ${JSON.stringify(rankingIds, null, 2)};
`;

console.log(output);
