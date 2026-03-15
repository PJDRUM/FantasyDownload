import React from "react";
import type { Position, Player } from "../models/Player";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { BoardCell, CellContent } from "./BoardCell";
import Cheatsheet from "./Cheatsheet";
import TeamLogo from "./TeamLogo";
import TeamsBoard from "./TeamsBoard";
import type { TiersByPos } from "../utils/xlsxRankings";
import { formatTeamAbbreviation } from "../utils/teamAbbreviation";

export type DraftStyle = "Snake Draft" | "Regular Draft" | "Third Round Reversal";
export type BoardTab = "Rankings Board" | "Draft Board" | "Cheatsheet" | "Teams";

function normalizeDraftAssignSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isReverseRound(roundIndex: number, style: DraftStyle) {
  if (style === "Regular Draft") return false;
  if (style === "Snake Draft") return roundIndex % 2 === 1;
  return roundIndex === 1 || (roundIndex >= 2 && roundIndex % 2 === 0);
}

const BOARD_BG_URL = `${process.env.PUBLIC_URL || ""}/bg.jpg`;

function MobileRankingsBoardCard(props: {
  pickLabel: string;
  directionArrow: string;
  player?: Player;
  favorite?: boolean;
  drafted?: boolean;
  bg: string;
  marginRight?: number;
  tabletMode?: boolean;
}) {
  const { pickLabel, directionArrow, player, favorite = false, drafted = false, bg, marginRight = 3, tabletMode = false } = props;
  const displayTeam = React.useMemo(() => {
    return formatTeamAbbreviation(player?.team, "FA");
  }, [player?.team]);
  const nameLines = React.useMemo(() => {
    if (!player?.name) return ["", ""];
    const parts = player.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [parts[0] ?? "", ""];
    const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
    const lastPart = parts[parts.length - 1] ?? "";
    const normalizedLastPart = lastPart.toLowerCase();

    if (parts.length >= 3 && suffixes.has(normalizedLastPart)) {
      return [parts.slice(0, -2).join(" "), parts.slice(-2).join(" ")];
    }

    return [parts.slice(0, -1).join(" "), lastPart];
  }, [player?.name]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: tabletMode ? 91 : 72,
        minWidth: tabletMode ? 91 : 72,
        height: tabletMode ? 64 : 48,
        marginRight,
        padding: tabletMode ? 5 : 4,
        position: "relative",
        overflow: "hidden",
        opacity: drafted ? 0.55 : 1,
        filter: drafted ? "grayscale(18%)" : undefined,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 5,
          right: 0,
          bottom: 5,
          left: 0,
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.12)",
          outline: "1px solid rgba(0,0,0,0.18)",
          background: bg,
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 5,
          right: 0,
          bottom: 5,
          left: 0,
          background: "rgba(0,0,0,0.1)",
          pointerEvents: "none",
          borderRadius: 7,
        }}
      />

      {favorite ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 4,
            right: 5,
            color: "#fbbf24",
            fontSize: 11,
            lineHeight: 1,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          ★
        </div>
      ) : null}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: player ? 0 : tabletMode ? 5 : 4,
            right: favorite ? (tabletMode ? 14 : 12) : 1,
            fontSize: tabletMode ? 7 : 6,
            lineHeight: 1,
            fontWeight: 700,
            color: "rgba(255,255,255,0.84)",
            letterSpacing: -0.1,
            textAlign: "right",
          }}
        >
          {pickLabel}
        </div>

        <div
          style={{
            position: "absolute",
            right: favorite ? (tabletMode ? 11 : 9) : 0,
            bottom: player ? (tabletMode ? 10 : 9) : tabletMode ? 6 : 5,
            fontSize: tabletMode ? 9 : 8,
            lineHeight: 1,
            fontWeight: 500,
            color: "rgba(255,255,255,0.84)",
            letterSpacing: -0.1,
          }}
        >
          {directionArrow}
        </div>

        {player?.team ? (
          <div
            style={{
              position: "absolute",
              top: tabletMode ? 12 : 8,
              right: favorite ? (tabletMode ? 12 : 10) : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TeamLogo
              team={player.team}
              size={tabletMode ? 15.625 : 14.0625}
              fallback={<span style={{ fontSize: tabletMode ? 7 : 6, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{displayTeam}</span>}
            />
          </div>
        ) : null}

        {player ? (
          <>
            <div
              style={{
                marginTop: tabletMode ? 9 : 7,
                paddingRight: favorite ? (tabletMode ? 34 : 29) : tabletMode ? 22 : 18,
                fontSize: tabletMode ? 8.5 : 7.5,
                lineHeight: 1,
                fontWeight: 650,
                color: "rgba(255,255,255,0.76)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: -0.1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span>{player.position}</span>
              <span style={{ opacity: 0.5 }}>-</span>
              <span>{displayTeam}</span>
            </div>

            <div
              style={{
                marginTop: tabletMode ? 4 : 3,
                paddingRight: favorite ? (tabletMode ? 18 : 16) : tabletMode ? 10 : 8,
                fontSize: tabletMode ? 9 : 8,
                lineHeight: tabletMode ? 1.02 : 1,
                fontWeight: 700,
                color: "rgba(255,255,255,0.97)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                gap: 0,
                minHeight: tabletMode ? 16 : 14,
                overflow: "hidden",
                letterSpacing: -0.08,
              }}
            >
              <span
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {nameLines[0]}
              </span>
              <span
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {nameLines[1]}
              </span>
            </div>
          </>
        ) : (
          <div
            style={{
              marginTop: "auto",
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 700,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            —
          </div>
        )}
      </div>
    </div>
  );
}

export default function Board(props: {
  favoriteIds: Set<string>;

  // Only the user Rankings list should be reorderable. KTC is static.
  allowRankingsReorder: boolean;

  boardTab: BoardTab;
  setBoardTab: (t: BoardTab) => void;

  rounds: number;
  setRounds: React.Dispatch<React.SetStateAction<number>>;

  teams: number;
  setTeams: React.Dispatch<React.SetStateAction<number>>;

  onAddPlayer: (name: string, position: Position) => void;
  draftStyle: DraftStyle;
  setDraftStyle: (s: DraftStyle) => void;

  rankingIds: string[];

  // optional: stable Rankings ordering for positional ranks on cheatsheet
  rankingsRankingIds?: string[];
  // optional: force the Cheatsheet to always use the Rankings tiers, regardless of active list
  rankingsTiersByPos?: TiersByPos;
  // optional: force tier edits from Cheatsheet to always update the Rankings tiers
  onUpdateRankingsTiersByPos?: (pos: Position, tierBreaks: string[]) => void;

  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
  onUpdateTiersByPos: (pos: Position, tierBreaks: string[]) => void;

  draftedIds: Set<string>;
  onToggleDrafted: (id: string) => void;
  clearAllDrafted: () => void;

  teamNames: string[];
  setTeamNames: React.Dispatch<React.SetStateAction<string[]>>;

  draftSlots: (string | null)[];

  posColor: (pos: Position) => string;

  sensors: any;
  onBoardDragEnd: (event: DragEndEvent) => void;
  onDraftBoardDragEnd: (event: DragEndEvent) => void;
  onAssignPlayerToDraftSlot: (slotIndex: number, playerId: string) => void;
  availableTabs?: BoardTab[];
  mobileMode?: boolean;
  tabletMode?: boolean;
  allowDraftBoardReorder?: boolean;
  showTabSwitcher?: boolean;
}) {
  const {
    favoriteIds,
    allowRankingsReorder,
    boardTab,
    setBoardTab,
    rounds,
    setRounds,
    teams,
    setTeams,
    onAddPlayer,
    draftStyle,
    setDraftStyle,
    rankingIds,
    rankingsRankingIds,
    rankingsTiersByPos,
    onUpdateRankingsTiersByPos,
    playersById,
    tiersByPos,
    onUpdateTiersByPos,
    draftedIds,
    onToggleDrafted,
    clearAllDrafted,
    teamNames,
    setTeamNames,
    draftSlots,
    posColor,
    sensors,
    onBoardDragEnd,
    onDraftBoardDragEnd,
    onAssignPlayerToDraftSlot,
    availableTabs,
    mobileMode = false,
    tabletMode = false,
    allowDraftBoardReorder = true,
    showTabSwitcher = true,
  } = props;

  // Cheatsheet should be driven purely by the Rankings list (order + tiers) so it looks identical
  // regardless of whether the RankingsList is on the Rankings tab or ADP tab.
  const cheatsheetRankingIds = rankingsRankingIds && rankingsRankingIds.length ? rankingsRankingIds : rankingIds;
  const cheatsheetTiersByPos = rankingsTiersByPos ?? tiersByPos;
  const cheatsheetOnUpdateTiersByPos = onUpdateRankingsTiersByPos ?? onUpdateTiersByPos;

  // Keep track of the last non-cheatsheet board mode so the toggle can return you to it.
  const lastNonCheatsheetRef = React.useRef<BoardTab>("Rankings Board");
  if (boardTab !== "Cheatsheet") lastNonCheatsheetRef.current = boardTab;

  const [newPlayerName, setNewPlayerName] = React.useState<string>("");
  const [newPlayerPos, setNewPlayerPos] = React.useState<Position>("RB");


// Draft-board: click an empty cell -> menu -> assign a player to that pick.
const [draftAssignMenu, setDraftAssignMenu] = React.useState<null | { slotIndex: number; x: number; y: number; label: string }>(null);
const [draftRemoveMenu, setDraftRemoveMenu] = React.useState<null | { slotIndex: number; x: number; y: number; label: string; playerId: string; playerName: string }>(null);
const [draftAssignModal, setDraftAssignModal] = React.useState<null | { slotIndex: number; label: string }>(null);
const [draftAssignQuery, setDraftAssignQuery] = React.useState<string>("");

  const draftAssignInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!draftAssignModal) return;
    const raf = window.requestAnimationFrame(() => {
      draftAssignInputRef.current?.focus();
      draftAssignInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [draftAssignModal]);


  const draftAssignCandidates = React.useMemo<string[]>(() => {
    if (!draftAssignModal) return [];
    const q = normalizeDraftAssignSearch(draftAssignQuery);

    const ids = Object.keys(playersById).filter((id) => !draftedIds.has(id));

    const filtered = !q
      ? ids
      : ids.filter((id) => {
          const p = playersById[id];
          if (!p) return false;
          const name = normalizeDraftAssignSearch(p.name ?? "");
          const pos = normalizeDraftAssignSearch((p as any).pos ?? "");
          const team = normalizeDraftAssignSearch((p as any).team ?? "");
          return name.includes(q) || pos.includes(q) || team.includes(q);
        });

    // Stable-ish alphabetical ordering for the modal list.
    filtered.sort((a, b) => {
      const pa = playersById[a];
      const pb = playersById[b];
      return (pa?.name ?? "").localeCompare(pb?.name ?? "");
    });

    return filtered;
  }, [draftAssignModal, draftAssignQuery, playersById, draftedIds]);



  const canAddPlayer = newPlayerName.trim().length > 0;
  const submitAddPlayer = React.useCallback(() => {
    const name = newPlayerName.trim();
    if (!name) return;
    onAddPlayer(name, newPlayerPos);
    setNewPlayerName("");
  }, [newPlayerName, newPlayerPos, onAddPlayer]);

  const isCheat = boardTab === "Cheatsheet";
  const isTeams = boardTab === "Teams";
  const isDraft = boardTab === "Draft Board";
  const isRank = boardTab === "Rankings Board";
  const compactMobileMode = mobileMode && !tabletMode;
  const boardCellWidth = mobileMode ? (tabletMode ? 91 : 72) : 140;
  const boardCellMinWidth = mobileMode ? (tabletMode ? 91 : 72) : 140;
  const draftBoardCellMinHeight = mobileMode ? (tabletMode ? 64 : 48) : undefined;
  const boardCellRadius = mobileMode ? 7 : 16;
  const boardCellPadding = mobileMode ? (tabletMode ? 5 : 4) : 8;
  const boardCellMarginRight = mobileMode ? (tabletMode ? 2 : 1) : 4;
  const showBoardCellImages = tabletMode || !mobileMode;
  const visibleTabs = availableTabs ?? ["Rankings Board", "Draft Board", "Cheatsheet", "Teams"];
  const showRankTab = visibleTabs.includes("Rankings Board");
  const showDraftTab = visibleTabs.includes("Draft Board");
  const showCheatsheetTab = visibleTabs.includes("Cheatsheet");
  const showTeamsTab = visibleTabs.includes("Teams");

  // Measure the non-cheatsheet board (Rankings/Draft) so Cheatsheet can reserve the same space.
  const tableSizeRef = React.useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = tableSizeRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      // Avoid thrashing state for sub-pixel changes
      const next = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
      setTableSize((prev) => {
        if (prev && prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    update();

    // ResizeObserver is supported in modern browsers; if unavailable, gracefully do nothing beyond initial update.
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    teams,
    rounds,
    draftStyle,
    // Re-measure when toggling between ADP and Draft since the header row differs.
    boardTab,
    // RankingIds changes can alter size (e.g., presence/absence of images may affect cell height).
    rankingIds,
    draftSlots,
  ]);



  const rankingBoardSortableIds = React.useMemo(() => {
    const ids: string[] = [];

    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const reverse = isReverseRound(roundIndex, draftStyle);

      for (let teamIndex = 0; teamIndex < teams; teamIndex += 1) {
        const pickIndex = reverse
          ? roundIndex * teams + (teams - 1 - teamIndex)
          : roundIndex * teams + teamIndex;

        const playerId = rankingIds[pickIndex];
        if (playerId) ids.push(playerId);
      }
    }

    return ids;
  }, [draftStyle, rankingIds, rounds, teams]);
  const pillBase: React.CSSProperties = {
    boxSizing: "border-box",
    padding: "7px 12px",
    cursor: "pointer",
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--text-0)",
    fontWeight: 750,
    letterSpacing: 0.2,
    fontSize: 13,
    lineHeight: "16px",
    transition: "transform 80ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease, box-shadow 120ms ease",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  // Colorless translucent "selected" state (no green).
  const pillActive: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18), 0 10px 20px rgba(0,0,0,0.22)",
    fontWeight: 850,
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",

        // ✅ allow vertical expansion
        alignSelf: "stretch",
        height: "100%",
        minHeight: 0,

        boxSizing: "border-box",
        overflow: "auto",
        padding: mobileMode ? 0 : 12,
        borderRadius: mobileMode ? 0 : 16,
        border: mobileMode ? "none" : "1px solid var(--border-0)",
        backgroundColor: "var(--panel-bg)",
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${BOARD_BG_URL})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        boxShadow: mobileMode ? "none" : "var(--shadow-0)",
      }}
    >
      <style>{`
        .numStepper {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .numValue {
          min-width: 40px;
          text-align: center;
          font-weight: 800;
          font-size: 13px;
          color: var(--text-0);
          border: 1px solid var(--border-0);
          border-radius: 10px;
          padding: 4px 8px;
          background: transparent;
          user-select: none;
        }
        .numStepBtn {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 1px solid var(--border-0);
          background: transparent;
          color: var(--text-0);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 80ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
          padding: 0;
        }
        .numStepBtn:hover {
          background: var(--panel-bg-2);
          border-color: var(--border-1);
        }
        .numStepBtn:active {
          transform: scale(0.96);
          background: var(--panel-bg-3);
        }
        .numStepBtn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .numStepBtn:focus-visible {
          outline: 2px solid var(--border-1);
          outline-offset: 2px;
        }
        .numStepIcon {
          font-size: 14px;
          line-height: 1;
          display: inline-block;
        }
        .numStepIconDown {
          transform: translateY(-0.5px);
        }
        .numStepIconUp {
          transform: translateY(-0.5px) rotate(180deg);
        }

        .tabBtn:focus-visible {
          outline: 2px solid var(--border-1);
          outline-offset: 2px;
        }
        .tabBtn:active {
          transform: scale(0.98);
        }
      `}</style>
      <div
        style={{
          overflowY: "auto",
          height: "100%",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {showTabSwitcher && (
          <div
            style={{
              boxSizing: "border-box",
              display: "flex",
              justifyContent: mobileMode ? "flex-start" : "space-between",
              alignItems: "center",
              marginBottom: 8,
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* ADP/Draft segmented control */}
              <div
                style={{
                  boxSizing: "border-box",
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                  padding: 4,
                  borderRadius: 999,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg)",
                }}
              >
                {showRankTab && (
                  <button
                    className="tabBtn"
                    onClick={() => setBoardTab("Rankings Board")}
                    style={{
                      ...pillBase,
                      ...(isRank ? pillActive : {}),
                    }}
                    title="Rankings Board"
                  >
                    Rankings Board
                  </button>
                )}

                {showDraftTab && (
                  <button
                    className="tabBtn"
                    onClick={() => setBoardTab("Draft Board")}
                    style={{
                      ...pillBase,
                      ...(isDraft ? pillActive : {}),
                    }}
                    title="Draft Board"
                  >
                    Draft Board
                  </button>
                )}
              </div>

              {showCheatsheetTab && (
                <div
                  style={{
                    boxSizing: "border-box",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                    padding: 4,
                    borderRadius: 999,
                    border: "1px solid var(--border-0)",
                    background: "var(--panel-bg)",
                  }}
                >
                  <button
                    className="tabBtn"
                    onClick={() => setBoardTab("Cheatsheet")}
                    style={{
                      ...pillBase,
                      ...(isCheat ? pillActive : {}),
                    }}
                    title="Cheatsheet"
                  >
                    Cheatsheet
                  </button>
                </div>
              )}

              {showTeamsTab && (
                <div
                  style={{
                    boxSizing: "border-box",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                    padding: 4,
                    borderRadius: 999,
                    border: "1px solid var(--border-0)",
                    background: "var(--panel-bg)",
                  }}
                >
                  <button
                    className="tabBtn"
                    onClick={() => setBoardTab("Teams")}
                    style={{
                      ...pillBase,
                      ...(isTeams ? pillActive : {}),
                    }}
                    title="Teams"
                  >
                    Teams
                  </button>
                </div>
              )}
            </div>

            {!mobileMode && <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-0)" }}>Add Player:</span>
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAddPlayer();
                }}
                placeholder="Name"
                aria-label="Add player name"
                style={{
                  width: 140,
                  borderRadius: 10,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg-2)",
                  color: "var(--text-0)",
                  padding: "6px 10px",
                  outline: "none",
                }}
              />
              <select
                value={newPlayerPos}
                onChange={(e) => setNewPlayerPos(e.target.value as Position)}
                aria-label="Add player position"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg-2)",
                  color: "var(--text-0)",
                  padding: "6px 10px",
                  outline: "none",
                }}
              >
                {(["QB", "RB", "WR", "TE", "K", "DST"] as Position[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={submitAddPlayer}
                disabled={!canAddPlayer}
                aria-label="Add player"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: "1px solid var(--border-0)",
                  background: canAddPlayer ? "var(--panel-bg-3)" : "var(--panel-bg-2)",
                  color: "var(--text-0)",
                  cursor: canAddPlayer ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                +
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-0)" }}>Teams</span>
              <div className="numStepper">
                <div className="numValue" aria-label="Teams">
                  {teams}
                </div>
                <button
                  type="button"
                  className="numStepBtn"
                  onClick={() => setTeams((n) => Math.min(20, n + 1))}
                  disabled={teams >= 20}
                  aria-label="Increase teams"
                >
                  <span className="numStepIcon numStepIconUp">▾</span>
                </button>
                <button
                  type="button"
                  className="numStepBtn"
                  onClick={() => setTeams((n) => Math.max(2, n - 1))}
                  disabled={teams <= 2}
                  aria-label="Decrease teams"
                >
                  <span className="numStepIcon numStepIconDown">▾</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-0)" }}>Rounds</span>
              <div className="numStepper">
                <div className="numValue" aria-label="Rounds">
                  {rounds}
                </div>
                <button
                  type="button"
                  className="numStepBtn"
                  onClick={() => setRounds((n) => Math.min(40, n + 1))}
                  disabled={rounds >= 40}
                  aria-label="Increase rounds"
                >
                  <span className="numStepIcon numStepIconUp">▾</span>
                </button>
                <button
                  type="button"
                  className="numStepBtn"
                  onClick={() => setRounds((n) => Math.max(1, n - 1))}
                  disabled={rounds <= 1}
                  aria-label="Decrease rounds"
                >
                  <span className="numStepIcon numStepIconDown">▾</span>
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-0)" }}>Draft Style</span>
              <select
                value={draftStyle}
                onChange={(e) => setDraftStyle(e.target.value as DraftStyle)}
                style={{
                  background: "transparent",
                  color: "var(--text-0)",
                  border: "1px solid var(--border-0)",
                  borderRadius: 10,
                  padding: "4px 8px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="Snake Draft">Snake Draft</option>
                <option value="Regular Draft">Regular Draft</option>
                <option value="Third Round Reversal">Third Round Reversal</option>
              </select>
            </div>

            <button
              onClick={clearAllDrafted}
              style={{
                boxSizing: "border-box",
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
                color: "var(--text-0)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Undraft All
            </button>
            </div>}
          </div>
        )}

        {boardTab === "Rankings Board" ? (
          <div ref={tableSizeRef}>
            {mobileMode ? (
              <>
                {Array.from({ length: rounds }).map((_, roundIndex) => {
                  const reverse = isReverseRound(roundIndex, draftStyle);
                  const roundNumber = roundIndex + 1;

                  return (
                    <div key={roundIndex} style={{ marginBottom: tabletMode ? -8 : -8 }}>
                      <div style={{ display: "flex" }}>
                        {Array.from({ length: teams }).map((_, teamIndex) => {
                          const pickIndex = reverse
                            ? roundIndex * teams + (teams - 1 - teamIndex)
                            : roundIndex * teams + teamIndex;

                          const playerId = rankingIds[pickIndex] ?? null;
                          const player = playerId ? playersById[playerId] : undefined;
                          const pickInRound = reverse ? teams - teamIndex : teamIndex + 1;
                          const baseLabel = `${roundNumber}.${String(pickInRound).padStart(2, "0")}`;
                          const directionArrow = reverse ? "←" : "→";

                          return (
                            <MobileRankingsBoardCard
                              key={playerId ?? `rankingslot:${pickIndex}`}
                              pickLabel={baseLabel}
                              directionArrow={directionArrow}
                              player={player}
                              drafted={playerId ? draftedIds.has(playerId) : false}
                              bg={player ? posColor(player.position) : "var(--surface-0)"}
                              marginRight={boardCellMarginRight}
                              tabletMode={tabletMode}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <DndContext sensors={allowRankingsReorder ? sensors : undefined} onDragEnd={allowRankingsReorder ? onBoardDragEnd : undefined}>
                <SortableContext items={rankingBoardSortableIds} strategy={rectSortingStrategy}>
                  {Array.from({ length: rounds }).map((_, roundIndex) => {
                    const reverse = isReverseRound(roundIndex, draftStyle);
                    const roundNumber = roundIndex + 1;

                    return (
                      <div key={roundIndex} style={{ marginBottom: 2 }}>
                        <div style={{ display: "flex" }}>
                          {Array.from({ length: teams }).map((_, teamIndex) => {
                            const pickIndex = reverse
                              ? roundIndex * teams + (teams - 1 - teamIndex)
                              : roundIndex * teams + teamIndex;

                            const playerId = rankingIds[pickIndex] ?? null;
                            const player = playerId ? playersById[playerId] : undefined;

                            const pickInRound = reverse ? teams - teamIndex : teamIndex + 1;
                            const baseLabel = `${roundNumber}.${String(pickInRound).padStart(2, "0")}`;
                            const label = reverse ? `← ${baseLabel}` : `${baseLabel} →`;

                            if (!playerId || !player) {
                              return (
                                <BoardCell
                                  key={`rankingslot:${pickIndex}`}
                                  id={`rankingslot:${pickIndex}`}
                                  drafted={false}
                                  dimWhenDrafted={false}
                                  showDraftedBanner={false}
                                  onToggleDrafted={() => {}}
                                  bg={"var(--surface-0)"}
                                  sortable={false}
                                  width={boardCellWidth}
                                  minWidth={boardCellMinWidth}
                                  borderRadius={boardCellRadius}
                                  padding={boardCellPadding}
                                  marginRight={boardCellMarginRight}
                                  clickable
                                >
                                  <CellContent
                                    label={label}
                                    name={"—"}
                                    position={" "}
                                    team={undefined}
                                    imageUrl={undefined}
                                    showDash={false}
                                    showImage
                                  />
                                </BoardCell>
                              );
                            }

                            return (
                              <BoardCell
                                key={playerId}
                                id={playerId}
                                drafted={draftedIds.has(playerId)}
                                dimWhenDrafted={true}
                                showDraftedBanner={true}
                                onToggleDrafted={onToggleDrafted}
                                bg={posColor(player.position)}
                                sortable={allowRankingsReorder}
                                width={boardCellWidth}
                                minWidth={boardCellMinWidth}
                                borderRadius={boardCellRadius}
                                padding={boardCellPadding}
                                marginRight={boardCellMarginRight}
                                clickable
                              >
                                <CellContent
                                  label={label}
                                  name={player.name}
                                  position={player.position}
                                  team={player.team}
                                  imageUrl={player.imageUrl}
                                  showDash
                                  showImage
                                />
                              </BoardCell>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>
        ) : boardTab === "Cheatsheet" ? (
          <div
            style={{
              // Reserve the same space as the main board so tab switching doesn't "shrink" the container.
              minWidth: mobileMode ? 0 : tableSize?.width,
              minHeight: tableSize?.height,
              width: mobileMode ? "100%" : undefined,

              // Center the cheatsheet columns within the reserved space.
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Cheatsheet
              favoriteIds={favoriteIds}
              rankingIds={cheatsheetRankingIds}
              rankingsRankingIds={cheatsheetRankingIds}
              playersById={playersById}
              tiersByPos={cheatsheetTiersByPos}
              onUpdateTiersByPos={cheatsheetOnUpdateTiersByPos}
              draftedIds={draftedIds}
              onToggleDrafted={onToggleDrafted}
              allowDraftToggle={!mobileMode}
              posColor={posColor}
              fitToViewport={mobileMode}
            />
          </div>
        ) : boardTab === "Teams" ? (
          <div
            style={{
              minWidth: mobileMode ? 0 : tableSize?.width,
              minHeight: tableSize?.height,
              width: mobileMode ? "100%" : undefined,
            }}
          >
            <TeamsBoard
              teams={teams}
              rounds={rounds}
              draftStyle={draftStyle}
              draftSlots={draftSlots}
              teamNames={teamNames}
              playersById={playersById}
              posColor={posColor}
              fitToViewport={mobileMode}
            />
          </div>
        ) : (
          <div ref={tableSizeRef}>
            <DndContext
              sensors={allowDraftBoardReorder ? sensors : undefined}
              onDragEnd={allowDraftBoardReorder ? onDraftBoardDragEnd : undefined}
            >
              <div style={{ display: "flex" }}>
                {Array.from({ length: teams }).map((_, teamIndex) => (
                  <div
                    key={teamIndex}
                    style={{
                      boxSizing: "border-box",
                      width: mobileMode ? (tabletMode ? 91 : 72) : boardCellWidth,
                      minWidth: mobileMode ? (tabletMode ? 91 : 72) : boardCellMinWidth,
                      marginRight: boardCellMarginRight,
                      borderRadius: mobileMode ? 7 : boardCellRadius,
                      border: "1px solid rgba(255,255,255,0.10)",
                      outline: "1px solid rgba(0,0,0,0.18)",
                      background: "var(--panel-bg)",
                      padding: mobileMode ? (tabletMode ? 5 : 4) : boardCellPadding,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <input
                      value={teamNames[teamIndex] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTeamNames((prev) => {
                          const next = [...prev];
                          next[teamIndex] = value;
                          return next;
                        });
                      }}
                      style={{
                        boxSizing: "border-box",
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "var(--text-0)",
                        fontWeight: 800,
                        fontSize: mobileMode ? 12 : 13,
                        textAlign: "center",
                        padding: 2,
                      }}
                      placeholder={`Team ${teamIndex + 1}`}
                    />
                  </div>
                ))}
              </div>

              <SortableContext
                items={draftSlots.map((_, i) => `draftslot:${i}`)}
                strategy={horizontalListSortingStrategy}
              >
                {Array.from({ length: rounds }).map((_, roundIndex) => {
                  const reverse = isReverseRound(roundIndex, draftStyle);
                  const roundNumber = roundIndex + 1;

                  return (
                    <div key={roundIndex} style={{ marginBottom: mobileMode ? -8 : 2 }}>
                      <div style={{ display: "flex" }}>
                        {Array.from({ length: teams }).map((_, teamIndex) => {
                          const pickIndex = reverse
                            ? roundIndex * teams + (teams - 1 - teamIndex)
                            : roundIndex * teams + teamIndex;

                          const pickInRound = reverse ? teams - teamIndex : teamIndex + 1;
                          const baseLabel = `${roundNumber}.${String(pickInRound).padStart(2, "0")}`;
                          const label = reverse ? `← ${baseLabel}` : `${baseLabel} →`;
                          const directionArrow = reverse ? "←" : "→";

                          const playerId = draftSlots[pickIndex];
                          if (!playerId) {
                            if (mobileMode) {
                              return (
                                <MobileRankingsBoardCard
                                  key={`draftslot:${pickIndex}`}
                                  pickLabel={baseLabel}
                                  directionArrow={directionArrow}
                                  player={undefined}
                                  bg={"var(--surface-0)"}
                                  marginRight={boardCellMarginRight}
                                  tabletMode={tabletMode}
                                />
                              );
                            }
                            return (
                              <BoardCell
                                key={`draftslot:${pickIndex}`}
                                id={`draftslot:${pickIndex}`}
                                drafted={false}
                                dimWhenDrafted={false}
                                showDraftedBanner={false}
                                onToggleDrafted={() => {}}
                                onClick={mobileMode ? () => {} : (e) => {
                                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                  setDraftRemoveMenu(null);
                                  setDraftAssignMenu({
                                    slotIndex: pickIndex,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2,
                                    label,
                                  });
                                }}
                                bg={"var(--surface-0)"}
                                sortable={allowDraftBoardReorder}
                                width={boardCellWidth}
                                minWidth={boardCellMinWidth}
                                minHeight={draftBoardCellMinHeight}
                                borderRadius={boardCellRadius}
                                padding={boardCellPadding}
                                marginRight={boardCellMarginRight}
                                clickable={!mobileMode}
                              >
                                <CellContent
                                  label={label}
                                  name={"—"}
                                  position={" "}
                                  team={undefined}
                                  imageUrl={undefined}
                                  showDash={false}
                                  showImage={showBoardCellImages}
                                  compact={compactMobileMode}
                                  clampNameLines={2}
                                />
                              </BoardCell>
                            );
                          }

                          const player = playersById[playerId];
                          if (!player) {
                            if (mobileMode) {
                              return (
                                <MobileRankingsBoardCard
                                  key={`draftslot:${pickIndex}`}
                                  pickLabel={baseLabel}
                                  directionArrow={directionArrow}
                                  player={undefined}
                                  drafted={draftedIds.has(playerId)}
                                  bg={"var(--surface-0)"}
                                  marginRight={boardCellMarginRight}
                                  tabletMode={tabletMode}
                                />
                              );
                            }
                            return (
                              <BoardCell
                                key={`draftslot:${pickIndex}`}
                                id={`draftslot:${pickIndex}`}
                                drafted={draftedIds.has(playerId)}
                                dimWhenDrafted={false}
                              showDraftedBanner={false}
                                onToggleDrafted={onToggleDrafted}
                                bg={"var(--surface-0)"}
                                sortable={allowDraftBoardReorder}
                                width={boardCellWidth}
                                minWidth={boardCellMinWidth}
                                minHeight={draftBoardCellMinHeight}
                                borderRadius={boardCellRadius}
                                padding={boardCellPadding}
                                marginRight={boardCellMarginRight}
                                clickable={!mobileMode}
                              >
                              <CellContent
                                label={label}
                                name={"—"}
                                position={" "}
                                team={undefined}
                                imageUrl={undefined}
                                showDash={false}
                                showImage={showBoardCellImages}
                                compact={compactMobileMode}
                                clampNameLines={2}
                              />
                              </BoardCell>
                            );
                          }

                          if (mobileMode) {
                            return (
                              <MobileRankingsBoardCard
                                key={`draftslot:${pickIndex}`}
                                pickLabel={baseLabel}
                                directionArrow={directionArrow}
                                player={player}
                                drafted={draftedIds.has(playerId)}
                                bg={posColor(player.position)}
                                marginRight={boardCellMarginRight}
                                tabletMode={tabletMode}
                              />
                            );
                          }

                          return (
                            <BoardCell
                              key={`draftslot:${pickIndex}`}
                              id={`draftslot:${pickIndex}`}
                              drafted={draftedIds.has(playerId)}
                              dimWhenDrafted={false}
                              showDraftedBanner={false}
                              onToggleDrafted={mobileMode ? () => {} : onToggleDrafted}
                              onClick={mobileMode ? () => {} : (e) => {
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                setDraftAssignMenu(null);
                                setDraftRemoveMenu({
                                  slotIndex: pickIndex,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top + rect.height / 2,
                                  label,
                                  playerId,
                                  playerName: player.name,
                                });
                              }}
                              bg={posColor(player.position)}
                              sortable={allowDraftBoardReorder}
                              width={boardCellWidth}
                              minWidth={boardCellMinWidth}
                              minHeight={draftBoardCellMinHeight}
                              borderRadius={boardCellRadius}
                              padding={boardCellPadding}
                              marginRight={boardCellMarginRight}
                              clickable={!mobileMode}
                            >
                              <CellContent
                                label={label}
                                name={player.name}
                                position={player.position}
                                team={player.team}
                                imageUrl={player.imageUrl}
                                showDash
                                showImage={showBoardCellImages}
                                compact={compactMobileMode}
                                clampNameLines={2}
                              />
                            </BoardCell>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        )}


{/* Draft-board: Assign Player menu */}
{isDraft && !mobileMode && draftAssignMenu && (
  <div
    onClick={() => setDraftAssignMenu(null)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 2000,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: Math.min(window.innerWidth - 220, Math.max(12, draftAssignMenu.x - 110)),
        top: Math.min(window.innerHeight - 140, Math.max(12, draftAssignMenu.y - 20)),
        width: 220,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(20,20,24,0.92)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        padding: 10,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 8 }}>
        {draftAssignMenu.label}
      </div>

      <button
        onClick={() => {
          setDraftAssignModal({ slotIndex: draftAssignMenu.slotIndex, label: draftAssignMenu.label });
          setDraftAssignQuery("");
          setDraftAssignMenu(null);
        }}
        style={{
          width: "100%",
          padding: "10px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.08)",
          color: "var(--text-0)",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        Assign Player
      </button>
    </div>
  </div>
)}


{/* Draft-board: Remove Player menu */}
{isDraft && !mobileMode && draftRemoveMenu && (
  <div
    onClick={() => setDraftRemoveMenu(null)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 2000,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: Math.min(window.innerWidth - 240, Math.max(12, draftRemoveMenu.x - 120)),
        top: Math.min(window.innerHeight - 170, Math.max(12, draftRemoveMenu.y - 20)),
        width: 240,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(20,20,24,0.92)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        padding: 10,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 6 }}>
        {draftRemoveMenu.label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10, lineHeight: 1.25 }}>
        {draftRemoveMenu.playerName}
      </div>

      <button
        onClick={() => {
          onToggleDrafted(draftRemoveMenu.playerId);
          setDraftRemoveMenu(null);
        }}
        style={{
          width: "100%",
          padding: "10px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,75,75,0.18)",
          color: "var(--text-0)",
          fontWeight: 900,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        Remove Player
      </button>
    </div>
  </div>
)}
{/* Draft-board: Assign Player modal */}
{isDraft && !mobileMode && draftAssignModal && (
  <div
    onClick={() => setDraftAssignModal(null)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 2100,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(760px, 100%)",
        maxHeight: "min(80vh, 820px)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(18,18,22,0.96)",
        boxShadow: "0 22px 60px rgba(0,0,0,0.55)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 950, opacity: 0.9 }}>Assign Player</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{draftAssignModal.label}</div>
          </div>

          <button
            onClick={() => setDraftAssignModal(null)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "var(--text-0)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <input
          ref={draftAssignInputRef}
          autoFocus
          value={draftAssignQuery}
          onChange={(e) => setDraftAssignQuery(e.target.value)}
          placeholder="Search players..."
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-0)",
            outline: "none",
            fontWeight: 750,
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.72, marginTop: 8 }}>
          Showing available (undrafted) players only.
        </div>
      </div>

      <div style={{ padding: 12, overflow: "auto" }}>
        {draftAssignCandidates.length === 0 ? (
          <div style={{ padding: 18, opacity: 0.8, fontWeight: 750 }}>No matching available players.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {draftAssignCandidates.map((id: string) => {
              const p = playersById[id];
              if (!p) return null;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onAssignPlayerToDraftSlot(draftAssignModal.slotIndex, id);
                    if (!draftedIds.has(id)) onToggleDrafted(id);
                    setDraftAssignModal(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 10px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text-0)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <img
                    src={p.imageUrl || "/headshot-placeholder.svg"}
                    alt={p.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      objectFit: "cover",
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "rgba(255,255,255,0.35)",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/headshot-placeholder.svg";
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div style={{ fontWeight: 950, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 850 }}>{p.position}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
}
