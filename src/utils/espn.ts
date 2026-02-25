// src/utils/espn.ts

// Easy local toggle:
// - true  => localhost shows REAL ESPN headshots
// - false => localhost shows a placeholder (no ESPN requests)
const USE_ESPN_HEADSHOTS_ON_LOCALHOST = false;

// If you use the Vercel proxy in production, keep this true.
const USE_VERCEL_HEADSHOT_PROXY = true;
export function normalizeName(name: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/-/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function espnHeadshotUrl(espnId: string) {
  const id = encodeURIComponent(espnId);

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0");

  if (isLocalhost && !USE_ESPN_HEADSHOTS_ON_LOCALHOST) {
    return "/headshot-placeholder.svg";
  }

  if (USE_VERCEL_HEADSHOT_PROXY && !isLocalhost) {
    return `/api/headshot/${id}.png`;
  }

  return `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;
}

/**
 * Very small CSV parser that supports quoted fields.
 * Returns rows as string[][].
 */
export function parseSimpleCsv(text: string): string[][] {
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

  while (
    rows.length &&
    rows[rows.length - 1].every((c) => !String(c ?? "").trim())
  )
    rows.pop();

  return rows;
}

/**
 * Some environments / files end up "flattened" into a single parsed CSV row.
 * This function reconstructs rows by treating the first `width` cells as headers
 * and then chunking remaining cells into row-sized groups.
 */
export function parseCsvFixedWidthRows(text: string, width: number): string[][] {
  const rows = parseSimpleCsv(text);
  if (!rows.length) return rows;

  const header = (rows[0] ?? []).slice(0, width);
  const cells: string[] = [];

  // Anything beyond the header on the first parsed row belongs to data
  cells.push(...(rows[0] ?? []).slice(width));
  for (let i = 1; i < rows.length; i++) cells.push(...(rows[i] ?? []));

  // Trim trailing empty cells
  while (cells.length && !String(cells[cells.length - 1] ?? "").trim())
    cells.pop();

  const out: string[][] = [header];
  for (let i = 0; i + width <= cells.length; i += width) {
    out.push(cells.slice(i, i + width));
  }

  return out;
}

function looksLikeHeaderCell(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  // Header cells in ffb_ids tend to be snake_case-ish.
  if (s.length > 64) return false;
  return /^[a-z_]+$/.test(s);
}

/**
 * Robust parser for the mayscopeland/ffb_ids `player_ids.csv`.
 * - Uses normal CSV rows when they look consistent.
 * - Falls back to fixed-width reconstruction when the CSV gets flattened.
 */
export function parseEspnIdsCsv(text: string): string[][] {
  const rows = parseSimpleCsv(text);
  if (!rows.length) return rows;

  const header = rows[0] ?? [];
  const headerWidth = header.length;

  // If the file parses normally, most rows will match the header width.
  let consistent = true;
  const sample = Math.min(rows.length, 50);
  for (let i = 1; i < sample; i++) {
    const r = rows[i] ?? [];
    if (r.length !== headerWidth) {
      consistent = false;
      break;
    }
  }
  if (consistent) return rows;

  // Heuristic: header is a contiguous run of header-like cells at the front.
  let inferredWidth = 0;
  for (let i = 0; i < header.length; i++) {
    if (!looksLikeHeaderCell(header[i])) break;
    inferredWidth++;
  }

  // If inference fails, fall back to original parse.
  if (inferredWidth < 2) return rows;

  return parseCsvFixedWidthRows(text, inferredWidth);
}
