import React from "react";
import type { Position, Player } from "../models/Player";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { BoardCell, CellContent } from "./BoardCell";
import Cheatsheet from "./Cheatsheet";
import type { TiersByPos } from "../utils/xlsxRankings";

export type DraftStyle = "Snake Draft" | "Regular Draft" | "Third Round Reversal";
export type BoardTab = "Rankings Board" | "Draft Board" | "Cheatsheet";

function isReverseRound(roundIndex: number, style: DraftStyle) {
  if (style === "Regular Draft") return false;
  if (style === "Snake Draft") return roundIndex % 2 === 1;
  return roundIndex === 1 || (roundIndex >= 2 && roundIndex % 2 === 0);
}

const BOARD_BG_URL = `${process.env.PUBLIC_URL || ""}/bg.jpg`;
export default function Board(props: {
  favoriteIds: Set<string>;

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
}) {
  const {
    favoriteIds,
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
    const q = draftAssignQuery.trim().toLowerCase();

    const ids = Object.keys(playersById).filter((id) => !draftedIds.has(id));

    const filtered = !q
      ? ids
      : ids.filter((id) => {
          const p = playersById[id];
          if (!p) return false;
          const name = (p.name ?? "").toLowerCase();
          const pos = ((p as any).pos ?? "").toLowerCase();
          const team = ((p as any).team ?? "").toLowerCase();
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
  const isDraft = boardTab === "Draft Board";
  const isRank = boardTab === "Rankings Board";

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
        padding: 12,
        borderRadius: 16,
        border: "1px solid var(--border-0)",
        backgroundColor: "var(--panel-bg)",
        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${BOARD_BG_URL})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        boxShadow: "var(--shadow-0)",
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
        {/* Board Tabs */}
        <div
          style={{
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
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
            </div>

            {/* Cheatsheet as separate segmented control */}
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
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

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
              Unmark All
            </button>
          </div>
        </div>

        {boardTab === "Rankings Board" ? (
          <div ref={tableSizeRef}>
            <DndContext sensors={sensors} onDragEnd={onBoardDragEnd}>
              <SortableContext items={rankingIds} strategy={horizontalListSortingStrategy}>
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
                              >
                                <CellContent label={label} name={"—"} position={" "} imageUrl={undefined} showDash={false} />
                              </BoardCell>
                            );
                          }

                          return (
                            <BoardCell
                              key={playerId}
                              id={playerId}
                              drafted={draftedIds.has(playerId)}
                              favorite={favoriteIds.has(playerId)}
                              dimWhenDrafted={true}
                              showDraftedBanner={true}
                              onToggleDrafted={onToggleDrafted}
                              bg={posColor(player.position)}
                              sortable={true}
                            >
                              <CellContent
                                label={label}
                                name={player.name}
                                position={player.position}
                                imageUrl={player.imageUrl}
                                showDash
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
        ) : boardTab === "Cheatsheet" ? (
          <div
            style={{
              // Reserve the same space as the main board so tab switching doesn't "shrink" the container.
              minWidth: tableSize?.width,
              minHeight: tableSize?.height,

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
              posColor={posColor}
            />
          </div>
        ) : (
          <div ref={tableSizeRef}>
            <DndContext sensors={sensors} onDragEnd={onDraftBoardDragEnd}>
              <div style={{ display: "flex" }}>
                {Array.from({ length: teams }).map((_, teamIndex) => (
                  <div
                    key={teamIndex}
                    style={{
                      boxSizing: "border-box",
                      width: 140,
                      minWidth: 140,
                      marginRight: 4,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      outline: "1px solid rgba(0,0,0,0.18)",
                      background: "var(--panel-bg)",
                      padding: 8,
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
                        textAlign: "center",
                        padding: 2,
                      }}
                      placeholder={`Team ${teamIndex + 1}`}
                    />
                  </div>
                ))}
              </div>

              <SortableContext items={draftSlots.map((_, i) => `draftslot:${i}`)} strategy={horizontalListSortingStrategy}>
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

                          const pickInRound = reverse ? teams - teamIndex : teamIndex + 1;
                          const label = `${roundNumber}.${String(pickInRound).padStart(2, "0")}`;

                          const playerId = draftSlots[pickIndex];
                          if (!playerId) {
                            return (
                              <BoardCell
                                key={`draftslot:${pickIndex}`}
                                id={`draftslot:${pickIndex}`}
                                drafted={false}
                                dimWhenDrafted={false}
                                showDraftedBanner={false}
                                onToggleDrafted={() => {}}
                                onClick={(e) => {
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
                              >
                                <CellContent label={label} name={"—"} position={" "} imageUrl={undefined} showDash={false} />
                              </BoardCell>
                            );
                          }

                          const player = playersById[playerId];
                          if (!player) {
                            return (
                              <BoardCell
                                key={`draftslot:${pickIndex}`}
                                id={`draftslot:${pickIndex}`}
                                drafted={draftedIds.has(playerId)}
                                favorite={favoriteIds.has(playerId)}
                                dimWhenDrafted={false}
                                showDraftedBanner={false}
                                onToggleDrafted={onToggleDrafted}
                                bg={"var(--surface-0)"}
                              >
                                <CellContent label={label} name={"—"} position={" "} imageUrl={undefined} showDash={false} />
                              </BoardCell>
                            );
                          }

                          return (
                            <BoardCell
                              key={`draftslot:${pickIndex}`}
                              id={`draftslot:${pickIndex}`}
                              drafted={draftedIds.has(playerId)}
                              favorite={favoriteIds.has(playerId)}
                              dimWhenDrafted={false}
                              showDraftedBanner={false}
                              onToggleDrafted={onToggleDrafted}
                              onClick={(e) => {
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
                            >
                              <CellContent
                                label={label}
                                name={player.name}
                                position={player.position}
                                imageUrl={player.imageUrl}
                                showDash={false}
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
{isDraft && draftAssignMenu && (
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
{isDraft && draftRemoveMenu && (
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
{isDraft && draftAssignModal && (
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
