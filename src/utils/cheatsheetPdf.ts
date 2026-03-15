// src/utils/cheatsheetPdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Position, Player } from "../models/Player";
import { formatTeamAbbreviation } from "./teamAbbreviation";
import type { TiersByPos } from "./xlsxRankings";

/**
 * Backwards/forwards compatible options shape.
 * Some callers pass filename at top-level, others pass options.filename.
 */
export type CheatsheetPdfOptions = {
  filename?: string;
};

const POS_ORDER: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const s = (hex ?? "").trim().replace(/^#/, "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return { r: 0, g: 0, b: 0 };
  const n = Number.parseInt(v, 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getPlayerRankValue(p: Player | undefined | null): number {
  if (!p) return Number.POSITIVE_INFINITY;
  const v =
    (p as any).rank ??
    (p as any).overallRank ??
    (p as any).ranking ??
    (p as any).rankOverall ??
    (p as any).udkRank ??
    (p as any).rank_value;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function buildTiersForPos(args: {
  pos: Position;
  rankingIds: string[];
  playersById: Record<string, Player>;
  tierBreaks: string[];
}): { tier: number; ids: string[] }[] {
  const { pos, rankingIds, playersById, tierBreaks } = args;

  const indexById = new Map<string, number>();
  rankingIds.forEach((id, idx) => indexById.set(id, idx));

  const ids = rankingIds
    .filter((id) => playersById[id]?.position === pos)
    .slice()
    .sort((a, b) => {
      const ra = getPlayerRankValue(playersById[a]);
      const rb = getPlayerRankValue(playersById[b]);
      if (ra !== rb) return ra - rb;
      const ia = indexById.get(a) ?? 0;
      const ib = indexById.get(b) ?? 0;
      return ia - ib;
    });

  const breaks = (tierBreaks ?? []).filter(Boolean);
  if (breaks.length === 0) return [{ tier: 1, ids }];

  const tierIndexById = new Map<string, number>();
  for (let i = 0; i < breaks.length; i++) {
    const id = breaks[i];
    tierIndexById.set(id, i + 2); // break marks start of tier 2+
  }

  const out: { tier: number; ids: string[] }[] = [];
  let currentTier = 1;
  let bucket: string[] = [];

  for (const id of ids) {
    const nextTier = tierIndexById.get(id);
    if (nextTier && bucket.length > 0) {
      out.push({ tier: currentTier, ids: bucket });
      currentTier = nextTier;
      bucket = [];
    }
    bucket.push(id);
  }

  if (bucket.length > 0) out.push({ tier: currentTier, ids: bucket });
  return out;
}

function formatDateMMDDYYYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function positionLabel(pos: Position): string {
  switch (pos) {
    case "QB":
      return "Quarterbacks";
    case "RB":
      return "Running Backs";
    case "WR":
      return "Wide Receivers";
    case "TE":
      return "Tight Ends";
    case "K":
      return "Kickers";
    case "DST":
      return "Defense / Special Teams";
    default:
      return String(pos);
  }
}

function clampTeam(team: unknown): string {
  return formatTeamAbbreviation(team);
}

function formatPlayerLine(p: Player, rank: number): string {
  const name = String((p as any).name ?? "").trim();
  const team = clampTeam((p as any).team);
  const prefix = Number.isFinite(rank) ? `${rank}. ` : "";
  return team ? `${prefix}${name} (${team})` : `${prefix}${name}`;
}

function fitText(font: any, txt: string, size: number, maxWidth: number): string {
  const s = txt ?? "";
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  const ell = "…";
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = s.slice(0, mid) + ell;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, Math.max(0, lo)) + ell;
}

type PrintLine = { kind: "tier"; tier: number } | { kind: "player"; text: string };

function buildLinesForPos(args: {
  pos: Position;
  rankingIds: string[];
  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
}): PrintLine[] {
  const { pos, rankingIds, playersById, tiersByPos } = args;
  const tiers = buildTiersForPos({ pos, rankingIds, playersById, tierBreaks: tiersByPos[pos] ?? [] });

  const out: PrintLine[] = [];
  let rank = 0;
  for (const t of tiers) {
    out.push({ kind: "tier", tier: t.tier });
    for (const id of t.ids) {
      const p = playersById[id];
      if (!p) continue;
      rank += 1;
      out.push({ kind: "player", text: formatPlayerLine(p, rank) });
    }
  }
  return out;
}

/**
 * Dumb/simple export:
 * - One landscape page
 * - Spreadsheet-like columns:
 *   A: QBs, B: blank, C: RBs, D: blank, ...
 * - Tiers shown as "Tier #"
 * - Player rows shown as "Name, Team"
 * - Each position column stops when it hits the bottom of the page (no spillover)
 */
export async function exportCheatsheetPdf(args: {
  rankingIds: string[];
  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
  posColor: (pos: Position) => string;
  filename?: string;
  options?: CheatsheetPdfOptions;
}) {
  const { rankingIds, playersById, tiersByPos, posColor } = args;

  const chosenFilename = args.filename ?? args.options?.filename ?? "Cheatsheet.pdf";
  const filename = chosenFilename.replace(/\.pdf$/i, "") + ".pdf";

  const present = new Set<Position>();
  for (const id of rankingIds) {
    const p = playersById[id];
    if (p) present.add(p.position);
  }
  const positions = POS_ORDER.filter((p) => present.has(p));
  if (positions.length === 0) return;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // US Letter landscape
  const pageWidth = 792; // 11in * 72
  const pageHeight = 612; // 8.5in * 72

  // Layout
  const margin = 18;
  const topPad = 16;
  const bottomPad = 18;

  // "Spreadsheet" columns: pos, blank, pos, blank, ...
  const colCount = Math.max(1, positions.length * 2 - 1);
  const colW = (pageWidth - margin * 2) / colCount;

  // Typography (small to fit all positions)
  const headerSize = 7.5;
  const dateSize = 7;
  const tierSize = 6.5;
  const playerSize = 6.25;

  const headerH = 12;
  const lineH = 7.25;

  const textBlack = rgb(0, 0, 0);
  const textWhite = rgb(1, 1, 1);
  const gridGray = rgb(0.88, 0.88, 0.88);

  const gridTop = pageHeight - margin - topPad;
  const gridBottom = margin;
  const headerY = gridTop - headerH;

  // Pre-build lines per position so we can continue on a second page if needed.
  const linesByPos: Partial<Record<Position, PrintLine[]>> = {};
  for (const pos of positions) {
    linesByPos[pos] = buildLinesForPos({ pos, rankingIds, playersById, tiersByPos });
  }

  const createPage = () => {
    const page = pdf.addPage([pageWidth, pageHeight]);

    // Optional light grid
    for (let c = 1; c < colCount; c++) {
      const x = margin + c * colW;
      page.drawLine({
        start: { x, y: gridBottom },
        end: { x, y: gridTop },
        thickness: 0.5,
        color: gridGray,
      });
    }

    // Title + date (small)
    const title = "Cheatsheet";
    page.drawText(title, {
      x: margin,
      y: pageHeight - margin - 10,
      size: 10,
      font: fontBold,
      color: textBlack,
    });

    const dateText = formatDateMMDDYYYY(new Date());
    const dateW = font.widthOfTextAtSize(dateText, dateSize);
    page.drawText(dateText, {
      x: pageWidth - margin - dateW,
      y: pageHeight - margin - 9,
      size: dateSize,
      font,
      color: textBlack,
    });

    return page;
  };

  const renderPage = (page: any, startIndexByPos: Partial<Record<Position, number>>) => {
    const nextIndexByPos: Partial<Record<Position, number>> = { ...startIndexByPos };

    // Render each position in its own "A/C/E..." column with a blank in between.
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const colIndex = i * 2; // 0,2,4,...
      const x = margin + colIndex * colW;

      const { r, g, b } = hexToRgb01(posColor(pos));
      const posRgb = rgb(r, g, b);

      // Column header (e.g. "Quarterbacks")
      const headerText = positionLabel(pos);
      // Center header text
      const headerFit = fitText(fontBold, headerText, headerSize, colW - 4);
      const headerFitW = fontBold.widthOfTextAtSize(headerFit, headerSize);

      page.drawText(headerFit, {
        x: x + (colW - headerFitW) / 2,
        y: headerY,
        size: headerSize,
        font: fontBold,
        color: textBlack,
      });

      // Content
      let y = headerY - lineH * 2;

      // Blank cell under header (intentionally no text)
      const lines = (linesByPos[pos] ?? []) as PrintLine[];
      let idx = startIndexByPos[pos] ?? 0;

      for (; idx < lines.length; idx++) {
        if (y <= gridBottom + bottomPad) break; // stop adding when bottom reached

        const ln = lines[idx];
        if (ln.kind === "tier") {
          const tierText = `Tier ${ln.tier}`;
          // Tier cell background
          page.drawRectangle({ x, y: y - 2, width: colW, height: lineH, color: posRgb });
          page.drawText(fitText(fontBold, tierText, tierSize, colW - 4), {
            x: x + 2,
            y,
            size: tierSize,
            font: fontBold,
            color: textWhite,
          });
        } else {
          page.drawText(fitText(font, ln.text, playerSize, colW - 4), {
            x: x + 2,
            y,
            size: playerSize,
            font,
            color: textBlack,
          });
        }

        y -= lineH;
      }

      nextIndexByPos[pos] = idx;
    }

    return nextIndexByPos;
  };

  // Page 1
  let page = createPage();
  let nextIndexByPos = renderPage(page, {});

  // Page 2 (continuation), only if anything remains.
  const needsSecondPage = positions.some((pos) => {
    const lines = linesByPos[pos] ?? [];
    const idx = nextIndexByPos[pos] ?? 0;
    return idx < lines.length;
  });

  if (needsSecondPage) {
    page = createPage();
    nextIndexByPos = renderPage(page, nextIndexByPos);
  }
  const outBytes = await pdf.save();
  triggerDownload(outBytes, filename);
}
