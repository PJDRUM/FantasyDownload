#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/update-ktc-last-updated.mjs <path-to-rankings.ts> <timestamp>
 *
 * Replaces (or appends) the line:
 *   export const KTC_LAST_UPDATED = "MM/DD/YY hh:mma";
 */
import fs from "node:fs";
import path from "node:path";

const [, , filePathArg, timestamp] = process.argv;

if (!filePathArg || !timestamp) {
  console.error("Usage: node scripts/update-ktc-last-updated.mjs <rankings.ts> <timestamp>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), filePathArg);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");

// Match: export const KTC_LAST_UPDATED = "....";
const re = /export\s+const\s+KTC_LAST_UPDATED\s*=\s*"[^"]*"\s*;?/;

const line = `export const KTC_LAST_UPDATED = "${timestamp}";`;

let out;
if (re.test(src)) {
  out = src.replace(re, line);
} else {
  const trimmed = src.replace(/\s*$/,"");
  out = `${trimmed}\n\n${line}\n`;
}

fs.writeFileSync(filePath, out, "utf8");
console.log(`Updated KTC_LAST_UPDATED in ${filePathArg} -> ${timestamp}`);
