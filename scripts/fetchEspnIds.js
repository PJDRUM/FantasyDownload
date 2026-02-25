import fs from "fs";

const URL =
  "https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20000";

async function run() {
  const res = await fetch(URL);
  const data = await res.json();

  const map = {};

  for (const a of data.items) {
    if (!a.firstName || !a.lastName || !a.id) continue;
    const key = `${a.firstName} ${a.lastName}`.toLowerCase();
    map[key] = a.id;
  }

  fs.writeFileSync(
    "src/data/espnIds.json",
    JSON.stringify(map, null, 2)
  );

  console.log(`Saved ${Object.keys(map).length} ESPN player IDs`);
}

run();
