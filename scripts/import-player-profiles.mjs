#!/usr/bin/env node
/**
 * Import player profile links from a local filesystem tree into src/data/playerProfiles.json
 *
 * Source tree:
 *   <root>/<playerId>/<podcastName>/<file.(rtf|txt|md|...)>
 *
 * Output JSON shape:
 *   { [playerId: string]: Array<{ podcast: string; label: string; url: string }> }
 */
import fs from "node:fs";
import path from "node:path";

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function listDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function normalizePlayerId(raw) {
  const s = String(raw).trim();
  // Support folders accidentally created with leading/trailing quotes, e.g. `"omarion-hampton"`
  return s.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
}

function normalizePodcastName(raw) {
  return String(raw).trim();
}

function normalizeLabel(raw) {
  let s = String(raw).trim();
  // Common “filesystem-safe” substitutions
  s = s.replace(/_/g, "/");
  // If someone used ":" as a stand-in for "/", turn it back into "/"
  s = s.replace(/:/g, "/");
  return s;
}

function extractFirstUrl(text) {
  // Conservative URL match: stop at whitespace or quotes/angle brackets
  const m = text.match(/https?:\/\/[^\s"<>]+/i);
  if (!m) return null;

  let url = m[0].trim();

  // Strip trailing punctuation / RTF braces often attached in .rtf
  url = url.replace(/[)\]}>.,;:'"]+$/g, "");

  return url;
}

function readFileText(filePath) {
  // Read as utf8 but tolerate binary-ish content (rtf) by stripping NULs
  const buf = fs.readFileSync(filePath);
  return buf.toString("utf8").replace(/\u0000/g, "");
}

function main() {
  const root = process.argv[2] || "/Volumes/XMacMiniM4/Programs/PlayerProfiles";
  const projectRoot = process.cwd();
  const outPath = path.join(projectRoot, "src", "data", "playerProfiles.json");

  const result = {};

  if (!isDirectory(root)) {
    console.error(`PlayerProfiles root not found or not a directory: ${root}`);
    process.exit(1);
  }

  const playerDirs = listDir(root).filter(d => d.isDirectory() && !d.name.startsWith("."));

  for (const pd of playerDirs) {
    const rawPlayerId = pd.name;
    const playerId = normalizePlayerId(rawPlayerId);
    const playerPath = path.join(root, rawPlayerId);

    const podcastDirs = listDir(playerPath).filter(d => d.isDirectory() && !d.name.startsWith("."));
    for (const pod of podcastDirs) {
      const podcast = normalizePodcastName(pod.name);
      const podcastPath = path.join(playerPath, pod.name);

      const files = listDir(podcastPath).filter(d => d.isFile() && !d.name.startsWith("."));
      for (const f of files) {
        const filePath = path.join(podcastPath, f.name);
        const labelRaw = path.parse(f.name).name;
        const label = normalizeLabel(labelRaw);

        const text = readFileText(filePath);
        const url = extractFirstUrl(text);
        if (!url) continue;

        if (!result[playerId]) result[playerId] = [];
        result[playerId].push({ podcast, label, url });
      }
    }
  }

  // Stable sort for consistent diffs: by playerId, podcast, label
  for (const pid of Object.keys(result)) {
    result[pid].sort((a, b) => {
      const ap = (a.podcast || "").localeCompare(b.podcast || "");
      if (ap !== 0) return ap;
      return (a.label || "").localeCompare(b.label || "");
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log(`Wrote ${outPath}`);
  console.log(`Players imported: ${Object.keys(result).length}`);
}

main();
