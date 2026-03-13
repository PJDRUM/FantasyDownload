#!/usr/bin/env node
import fs from "node:fs";

const [, , tsPath, timestampArg] = process.argv;

if (!tsPath) {
  console.error('Usage: node update-consensus-last-updated.mjs <rankings.ts> <timestamp>');
  process.exit(1);
}

const timestamp =
  timestampArg ??
  new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .replace(", ", " ")
    .replace(" AM", "am")
    .replace(" PM", "pm");

const content = fs.readFileSync(tsPath, "utf8");
const line = `export const CONSENSUS_LAST_UPDATED = "${timestamp}";`;

const regex = /^export const CONSENSUS_LAST_UPDATED\s*=\s*".*?";\s*$/m;

let next;
if (regex.test(content)) {
  next = content.replace(regex, line);
} else {
  next = content.replace(/\s*$/, "\n" + line + "\n");
}

const lines = next.split(/\r?\n/);
let seen = false;
const deduped = lines
  .filter((l) => {
    if (/^export const CONSENSUS_LAST_UPDATED\s*=/.test(l)) {
      if (seen) return false;
      seen = true;
    }
    return true;
  })
  .join("\n");

fs.writeFileSync(tsPath, deduped.endsWith("\n") ? deduped : deduped + "\n", "utf8");
console.log(`Updated CONSENSUS_LAST_UPDATED in ${tsPath} -> ${timestamp}`);
