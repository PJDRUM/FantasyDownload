import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { Player, Position } from "../models/Player";
import type { RankingsListKey, TiersByPos } from "../utils/xlsxRankings";
import { RANKINGS_LIST_KEYS } from "../utils/xlsxRankings";
import { posColor } from "../utils/posColor";

import TierBar, { TierOverlay, type TierScope } from "./Rankings/TierBar";
import Headshot from "./Rankings/Headshot";
import { buildSearchMatches, type SearchMatch } from "./Rankings/searchUtils";
import { StarIcon, type FavoriteStarStyle } from "./Rankings/StarIcon";
import { score10ToPct } from "./Rankings/RiskUpside";
import PlayerProfileModal from "./PlayerProfileModal";
import { playerProfilesById } from "../data/playerProfiles";
import { KTC_LAST_UPDATED, ADP_LAST_UPDATED } from "../data/rankings";
const ENABLE_PLAYER_PROFILES_ON_RANKINGS_LIST = false; // Toggle to temporarily disable PlayerProfiles on the Rankings list.

type Tab = "Overall" | Position;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function getRiskRaw(p: Player): number | undefined {
  const v = (p as any).risk ?? (p as any).riskScore ?? (p as any).risk_score;
  return isFiniteNumber(v) ? v : undefined;
}

function getUpsideRaw(p: Player): number | undefined {
  const v = (p as any).upside ?? (p as any).upsideScore ?? (p as any).upside_score;
  return isFiniteNumber(v) ? v : undefined;
}

export default function RankingsList(props: {
  // which rankings set is shown
  rankingsListKey: RankingsListKey;
  setRankingsListKey: React.Dispatch<React.SetStateAction<RankingsListKey>>;

  // data for the active rankings set
  rankingIds: string[];
  // optional: the Rankings ordering (if the app wants to pass it for other components)
  rankingsRankingIds?: string[];
  playersById: Record<string, Player>;

  tiersByPos: TiersByPos;
  draftedIds: Set<string>;
  onToggleDrafted: (id: string) => void;

  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;

  activeTab: Tab;
  setActiveTab: (t: Tab) => void;

  // optional hook for parent-managed reordering/moves (backwards compatible)
  onMove?: (fromIndex: number, toIndex: number) => void;

  getColor: (pos: Position) => string;

  // KTC value display mode
  ktcValueMode?: "1qb" | "2qb";
  onChangeKtcValueMode?: (m: "1qb" | "2qb") => void;
  onSetAsRankings?: () => void;
}) {
  const {
    rankingsListKey,
    setRankingsListKey,
    rankingIds,
    playersById,
    tiersByPos,
    draftedIds,
    onToggleDrafted,
    favoriteIds,
    onToggleFavorite,
    activeTab,
    setActiveTab,
    getColor,
    ktcValueMode = "2qb",
    onChangeKtcValueMode,
    onSetAsRankings,
  } = props;

  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [rankingsFormat, setRankingsFormat] = useState<"Dynasty" | "Redraft">("Dynasty");
  const [hideDraftedPlayers, setHideDraftedPlayers] = useState(false);
  const [setAsRankingsFeedback, setSetAsRankingsFeedback] = useState(false);

  useLayoutEffect(() => {
    // Keep the secondary tab valid when switching between Dynasty/Redraft.
    if (rankingsFormat === "Redraft" && rankingsListKey === "KTC") setRankingsListKey("ADP");
    if (rankingsFormat === "Dynasty" && rankingsListKey === "ADP") setRankingsListKey("KTC");
  }, [rankingsFormat, rankingsListKey, setRankingsListKey]);

  useEffect(() => {
    if (!setAsRankingsFeedback) return;
    const timeoutId = window.setTimeout(() => setSetAsRankingsFeedback(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [setAsRankingsFeedback]);

  const hideRankColumn = false;

  // Only the Rankings tab has tier overlays.
  const showTiers = rankingsListKey === "Rankings" && activeTab !== "Overall";

  /**
   * Only show Risk/Upside columns if the import actually contains *meaningful* values.
   *
   * Some imports/parsers default missing numeric columns to 0, which would otherwise trick
   * a simple "any finite number" check into showing empty bars for everyone.
   *
   * Assumption: Risk/Upside are 0–10 scores; if the max value is 0, treat the column as absent.
   */
  const riskPresence = useMemo(() => {
    let seenFinite = false;
    let max = -Infinity;
    for (const id of rankingIds) {
      const p = playersById[id];
      if (!p) continue;
      const v = getRiskRaw(p);
      if (!isFiniteNumber(v)) continue;
      seenFinite = true;
      if (v > max) max = v;
    }
    return { seenFinite, max };
  }, [rankingIds, playersById]);

  const upsidePresence = useMemo(() => {
    let seenFinite = false;
    let max = -Infinity;
    for (const id of rankingIds) {
      const p = playersById[id];
      if (!p) continue;
      const v = getUpsideRaw(p);
      if (!isFiniteNumber(v)) continue;
      seenFinite = true;
      if (v > max) max = v;
    }
    return { seenFinite, max };
  }, [rankingIds, playersById]);

  const showRisk = riskPresence.seenFinite && riskPresence.max > 0;
  const showUpside = upsidePresence.seenFinite && upsidePresence.max > 0;

  const sortableEnabled = false; // Drag/drop disabled in RankingsList; only enabled on Rankings Board

  const presentPositions = useMemo(() => {
    const set = new Set<Position>();
    for (const id of rankingIds) {
      const p = playersById[id];
      if (p) set.add(p.position);
    }
    return set;
  }, [rankingIds, playersById]);

  const tabs: Tab[] = useMemo(() => {
    const base: Tab[] = ["Overall", "QB", "RB", "WR", "TE"];
    if (presentPositions.has("K")) base.push("K");
    if (presentPositions.has("DST")) base.push("DST");
    return base;
  }, [presentPositions]);

  const isOverall = activeTab === "Overall";

  React.useEffect(() => {
    // If the current tab no longer exists (e.g. import without K/DST), fall back to Overall.
    if (!tabs.includes(activeTab)) setActiveTab("Overall");
  }, [tabs, activeTab, setActiveTab]);

  // Shared scroll container + row refs across ALL tabs (needed for jump-to)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Search (jump-to, not filter)
  const [query, setQuery] = useState("");
  // Aliases (kept to match fantasy-board naming)
  const q = query;
  const setQ = setQuery;
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // Build ids for the active tab
  const idsForTabBase = useMemo(() => {
    const seen = new Set<string>();
    const uniq = (arr: string[]) => arr.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

    if (isOverall) return uniq(rankingIds);
    return uniq(rankingIds.filter((id) => playersById[id]?.position === activeTab));
  }, [isOverall, rankingIds, playersById, activeTab]);

  const idsForTab = useMemo(() => {
    if (!hideDraftedPlayers) return idsForTabBase;
    return idsForTabBase.filter((id) => !draftedIds.has(id));
  }, [idsForTabBase, hideDraftedPlayers, draftedIds]);

  const originalIndexById = useMemo(() => {
    const next: Record<string, number> = {};
    idsForTabBase.forEach((id, index) => {
      next[id] = index;
    });
    return next;
  }, [idsForTabBase]);

  const tierBreaks = useMemo(() => {
    if (!showTiers) return [];
    if (isOverall) return [];
    return tiersByPos?.[activeTab] ?? [];
  }, [showTiers, isOverall, tiersByPos, activeTab]);

  const visibleTierBreaks = useMemo(() => {
    if (idsForTab.length === 0 || tierBreaks.length === 0) return [];
    const visibleIdSet = new Set(idsForTab);
    return tierBreaks.filter((id) => visibleIdSet.has(id));
  }, [idsForTab, tierBreaks]);

  const matches: SearchMatch[] = useMemo(() => {
    return buildSearchMatches({
      query,
      idsForTab,
      playersById,
      isOverall,
      rankingIds,
      limit: 12,
    });
  }, [query, idsForTab, playersById, isOverall, rankingIds]);

  React.useEffect(() => {
    setActiveMatchIndex(0);
  }, [query, activeTab]);

  function flashHighlight(id: string) {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    setHighlightId(id);
    highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 900);
  }

  function scrollRowToTopVisible(id: string, opts?: { flash?: boolean }) {
    const container = containerRef.current;
    const row = rowRefs.current[id];
    if (!container || !row) return;

    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();

    // When we jump-to, the sticky header can cover the row.
    // Offset the scroll by the sticky header height (plus a tiny gap) so the row is fully visible.
    const headerH = stickyHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const gap = 8;

    container.scrollTop += rRect.top - cRect.top - headerH - gap;

    if (opts?.flash) flashHighlight(id);
  }

  function jumpToPlayer(id: string) {
    scrollRowToTopVisible(id, { flash: true });
    setQuery("");
  }

  // Compute tier bar positions
  const [gapTops, setGapTops] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const next: Record<string, number> = {};
    for (const startId of visibleTierBreaks) {
      const row = rowRefs.current[startId];
      if (!row) continue;
      const top = row.offsetTop;
      next[startId] = top;
    }
    setGapTops(next);
  }, [visibleTierBreaks, idsForTab, activeTab, rankingsListKey]);

  const tierNumById = useMemo(() => {
    const next: Record<string, number> = {};
    if (!showTiers || idsForTab.length === 0) return next;

    let currentTier = 1;
    let previousVisibleOriginalIndex = -1;
    const tierBreakIndices = tierBreaks
      .map((id) => originalIndexById[id])
      .filter((index): index is number => typeof index === "number")
      .sort((a, b) => a - b);

    for (const id of idsForTab) {
      const currentOriginalIndex = originalIndexById[id];
      const crossedBreak = tierBreakIndices.some(
        (breakIndex) => breakIndex > previousVisibleOriginalIndex && breakIndex <= currentOriginalIndex
      );

      if (previousVisibleOriginalIndex >= 0 && crossedBreak) {
        currentTier += 1;
      }

      next[id] = currentTier;
      previousVisibleOriginalIndex = currentOriginalIndex;
    }

    return next;
  }, [showTiers, idsForTab, tierBreaks, originalIndexById]);

  const currentScope: TierScope = activeTab === "Overall" ? "OVERALL" : activeTab;

  const showDropdown = query.trim().length > 0 && matches.length > 0;
  const accentGreen = "rgb(34, 197, 94)";
  const tierAccent = currentScope === "OVERALL" ? accentGreen : posColor(currentScope as Position);

  const ktcUpdated = useMemo(() => {
    const raw = String(KTC_LAST_UPDATED ?? "").trim();
    const parts = raw.split(/\s+/);
    if (parts.length <= 1) return { raw, date: raw, time: "" };
    return { raw, date: parts[0], time: parts.slice(1).join(" ") };
  }, []);
  const adpUpdated = useMemo(() => {
    const raw = String(ADP_LAST_UPDATED ?? "").trim();
    const parts = raw.split(/\s+/);
    if (parts.length <= 1) return { raw, date: raw, time: "" };
    return { raw, date: parts[0], time: parts.slice(1).join(" ") };
  }, []);

  // Selected-tab style: neutral translucent overlay (no green)
  const selectedPillBg = "rgba(255,255,255,0.14)";
  const selectedPillBorder = "1px solid rgba(255,255,255,0.16)";
  const selectedPillShadow = "inset 0 0 0 1px rgba(0,0,0,0.18)";

  const gridCols = useMemo(() => {
    const cols: string[] = ["28px", "minmax(0, 3fr)", "minmax(36px, 0.8fr)"]; // #, Player, ADP/Value
    if (showRisk) cols.push("minmax(54px, 1fr)");
    if (showUpside) cols.push("minmax(54px, 1fr)");
    return cols.join(" ");
  }, [showRisk, showUpside]);

  const leftGutterPx = 44; // space reserved for + / − button
  const rowCardPaddingPx = 10; // matches row card horizontal padding

  // Favorite Star Positioning (edit these values to fine tune)
  const FAVORITE_STAR: FavoriteStarStyle = {
    leftPx: leftGutterPx + rowCardPaddingPx + 427,
    topPx: 5,
    sizePx: 15,
    borderPx: 1,
  };

  // IMPORTANT: We are using inline Tier separators (TIER X) now.
  // Disable the absolute-position TierBar overlay to avoid the extra gray bars.
  const showTierBars = false;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 10 }}>
      {/* Format tabs: Redraft / Dynasty */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 999,
            border: "1px solid var(--border-0)",
            background: "var(--panel-bg)",
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "visible",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {(["Redraft", "Dynasty"] as const).map((k) => {
            const active = k === rankingsFormat;
            return (
              <button
                key={k}
                onClick={() => setRankingsFormat(k)}
                aria-label={k}
                title={k}
                style={{
                  border: active ? selectedPillBorder : "none",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                  background: active ? selectedPillBg : "transparent",
                  color: active ? "var(--text-0)" : "var(--text-1)",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  lineHeight: 1,
                  boxShadow: active ? selectedPillShadow : "none",
                }}
              >
                {k}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {rankingsFormat === "Dynasty" && rankingsListKey === "KTC" && onSetAsRankings && (
            <button
              type="button"
              onClick={() => {
                onSetAsRankings();
                setSetAsRankingsFeedback(true);
              }}
              aria-label={setAsRankingsFeedback ? "Rankings Set" : "Set as Rankings"}
              title={setAsRankingsFeedback ? "Rankings Set" : "Set as Rankings"}
              style={{
                border: setAsRankingsFeedback ? selectedPillBorder : "1px solid var(--border-0)",
                borderRadius: 999,
                padding: "10px 14px",
                fontWeight: 900,
                fontSize: 13,
                cursor: "pointer",
                background: setAsRankingsFeedback ? selectedPillBg : "var(--panel-bg)",
                color: setAsRankingsFeedback ? "var(--text-0)" : "var(--text-1)",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: setAsRankingsFeedback ? selectedPillShadow : "none",
                transform: setAsRankingsFeedback ? "scale(1.03)" : "scale(1)",
                transition: "transform 160ms ease, background 160ms ease, color 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
              }}
            >
              {setAsRankingsFeedback ? "Rankings Set!" : "Set as Rankings"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setHideDraftedPlayers((prev) => !prev)}
            aria-pressed={hideDraftedPlayers}
            aria-label={hideDraftedPlayers ? "Show Drafted" : "Hide Drafted"}
            title={hideDraftedPlayers ? "Show Drafted" : "Hide Drafted"}
            style={{
              border: hideDraftedPlayers ? selectedPillBorder : "1px solid var(--border-0)",
              borderRadius: 999,
              padding: "10px 14px",
              fontWeight: 900,
              fontSize: 13,
              cursor: "pointer",
              background: hideDraftedPlayers ? selectedPillBg : "var(--panel-bg)",
              color: hideDraftedPlayers ? "var(--text-0)" : "var(--text-1)",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: hideDraftedPlayers ? selectedPillShadow : "none",
            }}
          >
            {hideDraftedPlayers ? "Show Drafted" : "Hide Drafted"}
          </button>
        </div>
      </div>

      {/* Top bar: Rankings set tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 999,
            border: "1px solid var(--border-0)",
            background: "var(--panel-bg)",
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "visible",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {(rankingsFormat === "Redraft" ? (["Rankings", "ADP"] as const) : (["Rankings", "KTC"] as const)).map((k) => {
            const active = k === rankingsListKey;
            const label = k;
            const isUpdatedTab = k === "KTC" || k === "ADP";
            const updated = k === "KTC" ? ktcUpdated : adpUpdated;

            return isUpdatedTab ? (
              <span key={k} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <button
                  onClick={() => setRankingsListKey(k)}
                  aria-label={label}
                  title={label}
                  style={{
                    border: active ? selectedPillBorder : "none",
                    borderRadius: 999,
                    padding: "10px 14px",
                    fontWeight: 900,
                    fontSize: 13,
                    cursor: "pointer",
                    background: active ? selectedPillBg : "transparent",
                    color: active ? "var(--text-0)" : "var(--text-1)",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    lineHeight: 1,
                    boxShadow: active ? selectedPillShadow : "none",
                  }}
                >
                  {label}
                </button>
                {active && (
                  <span
                    aria-label={`Updated: ${updated.raw}`}
                    title={`Updated: ${updated.raw}`}
                    style={{
                      position: "absolute",
                      left: "calc(100% + 8px)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      fontSize: 10,
                      fontWeight: 700,
                      opacity: 0.65,
                      lineHeight: 1.05,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    <span>Updated:</span>
                    <span>{updated.date}</span>
                    {updated.time && <span>{updated.time}</span>}
                  </span>
                )}
              </span>
            ) : (
              <button
                key={k}
                onClick={() => setRankingsListKey(k)}
                aria-label={label}
                title={label}
                style={{
                  border: active ? selectedPillBorder : "none",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                  background: active ? selectedPillBg : "transparent",
                  color: active ? "var(--text-0)" : "var(--text-1)",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  lineHeight: 1,
                  boxShadow: active ? selectedPillShadow : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Position tabs */}
        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: 4,
            borderRadius: 999,
            border: "1px solid var(--border-0)",
            background: "var(--panel-bg)",
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {tabs.map((t) => {
            const active = t === activeTab;
            const activeBg =
              !active ? "transparent" : t === "Overall" ? selectedPillBg : posColor(t as Position);
            const activeBorder = active ? (t === "Overall" ? selectedPillBorder : "none") : "none";
            const activeShadow = active ? (t === "Overall" ? selectedPillShadow : "none") : "none";

            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  border: activeBorder,
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                  background: activeBg,
                  boxShadow: activeShadow,
                  color: active ? "var(--text-0)" : "var(--text-1)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search (jump-to; does not filter) */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--border-0)",
            borderRadius: 10,
            outline: "none",
            background: "var(--panel-bg)",
            color: "var(--text-0)",
            fontWeight: 700,
          }}
          onKeyDown={(e) => {
            if (!showDropdown) {
              if (e.key === "Escape") setQ("");
              return;
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveMatchIndex((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveMatchIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = matches[activeMatchIndex];
              if (pick) jumpToPlayer(pick.id);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setQ("");
            }
          }}
        />

        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 6,
              borderRadius: 14,
              zIndex: 80,
              maxHeight: 320,
              overflow: "auto",
              padding: 6,
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid var(--border-1)",
              boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              isolation: "isolate",
              outline: "1px solid rgba(34, 197, 94, 0.18)",
              outlineOffset: -1,
            }}
          >
            <div
              style={{
                padding: "8px 10px 4px",
                fontSize: "clamp(10px, 2.2vw, 12px)",
                fontWeight: 900,
                letterSpacing: 0.7,
                textTransform: "uppercase",
                color: "var(--text-1)",
                opacity: 0.9,
                userSelect: "none",
              }}
            >
              Matches
            </div>

            {matches.map((m, idx) => {
              const isActive = idx === activeMatchIndex;

              const p = playersById[m.id];
              const pos = (p?.position ?? (m.pos as Position)) as Position;
              const drafted = draftedIds.has(m.id);

              const rowBg = drafted ? "var(--surface-0)" : getColor(pos);
              const rowFg = drafted ? "var(--text-1)" : "#000";

              return (
                <div
                  key={m.id}
                  onMouseEnter={() => setActiveMatchIndex(idx)}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => jumpToPlayer(m.id)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    background: rowBg,
                    color: rowFg,
                    borderRadius: 12,
                    margin: "6px 6px 8px",
                    position: "relative",
                    userSelect: "none",
                    opacity: drafted ? 0.9 : 1,
                    border: isActive ? "2px solid rgba(34, 197, 94, 0.55)" : "1px solid rgba(255,255,255,0.10)",
                    boxShadow: isActive ? "0 0 0 2px rgba(0,0,0,0.12)" : "0 6px 14px rgba(0,0,0,0.18)",
                    transform: isActive ? "translateY(-1px)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Headshot src={p?.imageUrl} alt={m.name} />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name}
                      </div>
                      <div style={{ fontSize: "clamp(10px, 2.2vw, 12px)", opacity: 0.8 }}>{pos}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {drafted && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          letterSpacing: 0.4,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(240, 234, 234, 0.18)",
                        }}
                      >
                        DRAFTED
                      </div>
                    )}

                    <div style={{ fontSize: "clamp(10px, 2.2vw, 12px)", fontWeight: 900, opacity: 0.85 }}>
                      {hideRankColumn ? "\u00A0" : `#${m.rankLabel}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      <div
        className="rankings-scroll"
        ref={containerRef}
        style={{
          overflow: "auto",
          flex: 1,
          minHeight: 0,
          position: "relative",
          background: "transparent",
          borderRadius: 16,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Sticky column headers */}
        <div
          ref={stickyHeaderRef}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            padding: "10px 12px",
            background: "rgb(10, 12, 16)",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "none",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              gap: 6,
              minWidth: 0,
              width: "100%",
              alignItems: "center",
              paddingLeft: leftGutterPx + rowCardPaddingPx,
              paddingRight: rowCardPaddingPx,
              boxSizing: "border-box",
              fontSize: "clamp(10px, 2.2vw, 12px)",
              fontWeight: 900,
              letterSpacing: 0.6,
              color: "rgba(255,255,255,0.72)",
              textTransform: "uppercase",
              userSelect: "none",
            }}
          >
            <div>{hideRankColumn ? "\u00A0" : "#"}</div>
            <div>Player</div>

            {/* ADP / Value header (KTC toggle moved ABOVE the "Value" label) */}
            <div style={{ textAlign: "center" }}>
              {rankingsListKey !== "KTC" ? (
                "ADP"
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {onChangeKtcValueMode && (
                    <div
                      role="group"
                      aria-label="KTC value mode"
                      style={{
                        display: "inline-flex",
                        gap: 0,
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onChangeKtcValueMode("1qb")}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          lineHeight: "16px",
                          cursor: "pointer",
                          border: "none",
                          color: "rgba(255,255,255,0.9)",
                          background: ktcValueMode === "1qb" ? "rgba(255,255,255,0.16)" : "transparent",
                        }}
                      >
                        1QB
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeKtcValueMode("2qb")}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          lineHeight: "16px",
                          cursor: "pointer",
                          border: "none",
                          color: "rgba(255,255,255,0.9)",
                          background: ktcValueMode === "2qb" ? "rgba(255,255,255,0.16)" : "transparent",
                        }}
                      >
                        2QB
                      </button>
                    </div>
                  )}
                  <span>Value</span>
                </div>
              )}
            </div>

            {showRisk && <div style={{ textAlign: "center" }}>Risk</div>}
            {showUpside && <div style={{ textAlign: "center" }}>Upside</div>}
          </div>
        </div>

        {/* tier bars (disabled) */}
        {showTierBars &&
          visibleTierBreaks
            .filter((startId) => idsForTab.indexOf(startId) > 0 && typeof gapTops[startId] === "number")
            .map((startId) => (
              <TierBar key={`bar:${currentScope}:${startId}`} scope={currentScope} startId={startId} topPx={gapTops[startId]} />
            ))}

        {/* NOTE: remove horizontal padding so row background can "bleed" to the container edge */}
        <div style={{ paddingBottom: 10 }}>
          {idsForTab.length === 0 ? (
            <div
              style={{
                padding: "18px 14px",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.42)",
                color: "rgba(255,255,255,0.82)",
                fontWeight: 800,
              }}
            >
              No players to show. All players in this view are currently drafted.
            </div>
          ) : (
            idsForTab.map((id, idx) => {
              const p = playersById[id];
              if (!p) return null;

              const drafted = draftedIds.has(id);
              const favored = favoriteIds.has(id);
              const visibleOriginalIndex = originalIndexById[id];
              const previousVisibleOriginalIndex = idx === 0 ? -1 : originalIndexById[idsForTab[idx - 1]];
              const showTierHeader =
                showTiers &&
                idx > 0 &&
                tierBreaks.some(
                  (breakId) =>
                    originalIndexById[breakId] > previousVisibleOriginalIndex &&
                    originalIndexById[breakId] <= visibleOriginalIndex
                );

              const isHi = highlightId === id;
              const stableRank = (originalIndexById[id] ?? idx) + 1;

              const adpOrValue = rankingsListKey === "KTC"
                ? (ktcValueMode === "1qb" ? (p as any).value : (p as any).sfValue)
                : rankingsListKey === "ADP"
                  ? stableRank
                  : p.adp;
              const riskRaw = getRiskRaw(p);
              const upsideRaw = getUpsideRaw(p);

              const riskPct = score10ToPct(riskRaw);
              const upsidePct = score10ToPct(upsideRaw);

              const shouldShowOverlay = showTiers && idx === 0 ? true : showTierHeader;

              // Full-bleed row background (goes to the container edges)
              // Undrafted rows keep the alternating dark theme; drafted rows get a green-tinted highlight.
              const baseRowBg = idx % 2 === 0 ? "rgba(0,0,0,0.78)" : "rgba(35, 35, 35, 0.86)";
              const draftedRowBg = "rgba(34, 197, 94, 0.16)";
              const rowBg = drafted ? draftedRowBg : baseRowBg;

              return (
                <div
                  key={id}
                  ref={(el) => {
                    rowRefs.current[id] = el;
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      marginBottom: 0,
                      overflow: "visible",

                      // full-bleed row background (goes to the container edges)
                      background: rowBg,

                      // border now wraps the +/− gutter too
                      border: isHi ? "1px solid rgba(34, 197, 94, 0.45)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 0,

                      // include the left gutter area (where the button lives) inside the bordered row
                      paddingLeft: leftGutterPx,
                    }}
                  >
                    {shouldShowOverlay && <TierOverlay label={`TIER ${tierNumById[id] ?? 1}`} accentColor={tierAccent} />}

                    <button
                      type="button"
                      aria-label={drafted ? "Undraft player" : "Draft player"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDrafted(id);
                      }}
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: drafted ? "rgba(239, 68, 68, 0.18)" : "rgba(34, 197, 94, 0.18)",
                        color: drafted ? "rgb(239, 68, 68)" : accentGreen,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 18,
                        lineHeight: 1,
                        cursor: "pointer",
                        userSelect: "none",
                        zIndex: 6,
                      }}
                    >
                      {drafted ? "−" : "+"}
                    </button>

                    <button
                      type="button"
                      aria-label={favored ? "Unfavorite player" : "Favorite player"}
                      title={favored ? "Unfavorite" : "Favorite"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(id);
                      }}
                      style={{
                        all: "unset",
                        position: "absolute",
                        left: FAVORITE_STAR.leftPx,
                        top: FAVORITE_STAR.topPx,
                        cursor: "pointer",
                        width: FAVORITE_STAR.sizePx,
                        height: FAVORITE_STAR.sizePx,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        userSelect: "none",
                        zIndex: 7,
                        filter: favored ? "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" : "drop-shadow(0 2px 5px rgba(0,0,0,0.45))",
                      }}
                    >
                      <StarIcon
                        filled={favored}
                        sizePx={FAVORITE_STAR.sizePx}
                        borderPx={FAVORITE_STAR.borderPx}
                        color="#fbbf24"
                        outlineColor={favored ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)"}
                      />
                    </button>

                    {/* Inner content: keeps the same left gutter/padding, but is transparent so the row background can bleed edge-to-edge */}
                    <div
                      style={{
                        padding: "14px 10px",
                        background: "transparent",
                        color: "rgba(255,255,255,0.92)",
                        opacity: drafted ? 0.85 : 1,
                        userSelect: "none",
                        cursor: "default",
                        boxShadow: isHi ? "0 0 0 2px rgba(0,0,0,0.12)" : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: gridCols,
                          gap: 6,
                          minWidth: 0,
                          width: "100%",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.75)" }}>
                          {hideRankColumn ? "\u00A0" : stableRank}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <Headshot src={p?.imageUrl} alt={p.name} />

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                fontWeight: 900,
                                fontSize: "clamp(11px, 2.4vw, 16px)",
                                lineHeight: 1.1,
                                whiteSpace: "normal",
                                overflow: "visible",
                                textOverflow: "clip",
                                wordBreak: "break-word",
                              }}
                            >
                              {ENABLE_PLAYER_PROFILES_ON_RANKINGS_LIST ? (
                                <button
                                  type="button"
                                  onClick={() => setProfilePlayerId(p.id)}
                                  style={{
                                    minWidth: 0,
                                    padding: 0,
                                    margin: 0,
                                    border: "none",
                                    background: "transparent",
                                    color: "inherit",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    font: "inherit",
                                  }}
                                  title={`Open ${p.name} profile`}
                                >
                                  {p.name}
                                </button>
                              ) : (
                                <span>{p.name}</span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: "clamp(10px, 2.2vw, 12px)",
                                opacity: 0.75,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              <span>
                                <span style={{ color: posColor(p.position), fontWeight: 700 }}>{p.position}</span> •{" "}
                                {p.team ? p.team : "--"}
                              </span>
                              {drafted && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 900,
                                    letterSpacing: 0.4,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: "rgba(240, 234, 234, 0.14)",
                                    color: "rgba(255,255,255,0.86)",
                                  }}
                                >
                                  DRAFTED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            textAlign: "center",
                            fontWeight: 900,
                            fontSize: "clamp(10px, 2.2vw, 12px)",
                            color: "rgba(255,255,255,0.78)",
                          }}
                        >
                          {typeof adpOrValue === "number"
                            ? rankingsListKey === "KTC"
                              ? Math.round(adpOrValue).toLocaleString()
                              : adpOrValue.toFixed(1)
                            : "—"}
                        </div>

                        {showRisk && (
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <div
                              style={{
                                width: "100%",
                                maxWidth: "100%",
                                height: 10,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.22)",
                                overflow: "hidden",
                              }}
                            >
                              <div style={{ height: "100%", width: `${riskPct}%`, background: "rgb(239, 68, 68)" }} />
                            </div>
                          </div>
                        )}

                        {showUpside && (
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <div
                              style={{
                                width: "100%",
                                maxWidth: "100%",
                                height: 10,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.22)",
                                overflow: "hidden",
                              }}
                            >
                              <div style={{ height: "100%", width: `${upsidePct}%`, background: accentGreen }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {ENABLE_PLAYER_PROFILES_ON_RANKINGS_LIST && profilePlayerId && playersById[profilePlayerId] && (
        <PlayerProfileModal
          player={playersById[profilePlayerId]}
          links={playerProfilesById[profilePlayerId] ?? []}
          onClose={() => setProfilePlayerId(null)}
        />
      )}
    </div>
  );
}