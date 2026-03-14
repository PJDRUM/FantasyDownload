import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Position, Player } from "../models/Player";
import type { TiersByPos } from "../utils/xlsxRankings";
import Board, { type BoardTab, type DraftStyle } from "./Board";

function normalizeMobileSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

type MobileDraftCompanionViewProps = {
  favoriteIds: Set<string>;
  boardTab: BoardTab;
  setBoardTab: (tab: BoardTab) => void;
  rounds: number;
  setRounds: React.Dispatch<React.SetStateAction<number>>;
  teams: number;
  setTeams: React.Dispatch<React.SetStateAction<number>>;
  onAddPlayer: (name: string, position: Position) => void;
  draftStyle: DraftStyle;
  setDraftStyle: (style: DraftStyle) => void;
  rankingIds: string[];
  rankingsRankingIds: string[];
  rankingsTiersByPos: TiersByPos;
  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
  onUpdateTiersByPos: (pos: Position, tierBreaks: string[]) => void;
  onUpdateRankingsTiersByPos: (pos: Position, tierBreaks: string[]) => void;
  draftedIds: Set<string>;
  onToggleDrafted: (id: string) => void;
  clearAllDrafted: () => void;
  teamNames: string[];
  setTeamNames: React.Dispatch<React.SetStateAction<string[]>>;
  draftSlots: (string | null)[];
  onAssignPlayerToDraftSlot: (slotIndex: number, playerId: string) => void;
  posColor: (pos: Position) => string;
  sensors: any;
  onBoardDragEnd: (event: DragEndEvent) => void;
  onDraftBoardDragEnd: (event: DragEndEvent) => void;
  onMoveRankings: (fromIndex: number, toIndex: number) => void;
  onImportRankings: () => void;
  onExportRankings: () => void;
};

function MobileRankingRow(props: {
  id: string;
  player: Player;
  index: number;
  rank: number;
  drafted: boolean;
  sortable: boolean;
  posColor: (pos: Position) => string;
  onToggleDrafted: (id: string) => void;
}) {
  const { id, index, rank, player, drafted, sortable, posColor, onToggleDrafted } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  const accentGreen = "rgb(34, 197, 94)";
  const baseRowBg = index % 2 === 0 ? "rgba(8, 14, 36, 0.98)" : "rgba(12, 18, 44, 0.98)";
  const draftedRowBg = "rgba(34, 197, 94, 0.16)";
  const rowBg = drafted ? draftedRowBg : baseRowBg;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(verticalTransform),
        transition,
        opacity: isDragging ? 0.88 : 1,
        display: "grid",
        gridTemplateColumns: "42px 24px minmax(0, 1fr) 32px",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: rowBg,
      }}
    >
      <button
        type="button"
        onClick={() => onToggleDrafted(id)}
        aria-label={drafted ? "Undraft player" : "Draft player"}
        style={{
          height: 24,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 999,
          background: drafted ? "rgba(239, 68, 68, 0.18)" : "rgba(34, 197, 94, 0.18)",
          color: drafted ? "rgb(239, 68, 68)" : accentGreen,
          fontSize: 14,
          fontWeight: 900,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {drafted ? "−" : "+"}
      </button>

      <div
        style={{
          color: "rgba(255,255,255,0.72)",
          fontSize: 12,
          fontWeight: 900,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {rank}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--text-0)",
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: drafted ? 0.82 : 1,
          }}
        >
          {player.name}
        </div>
        <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.68)", fontSize: 10, fontWeight: 700 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: posColor(player.position),
              flex: "0 0 auto",
            }}
          />
          <span>{player.position}</span>
          <span>{player.team || "FA"}</span>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Reorder ${player.name}`}
        {...attributes}
        {...listeners}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.06)",
          color: sortable ? "rgba(255,255,255,0.84)" : "rgba(255,255,255,0.38)",
          cursor: sortable ? "grab" : "default",
          touchAction: sortable ? "none" : "auto",
          opacity: sortable ? 1 : 0.65,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function MobileDraftCompanionView(props: MobileDraftCompanionViewProps) {
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
    playersById,
    tiersByPos,
    onUpdateTiersByPos,
    onUpdateRankingsTiersByPos,
    draftedIds,
    onToggleDrafted,
    clearAllDrafted,
    teamNames,
    setTeamNames,
    draftSlots,
    onAssignPlayerToDraftSlot,
    posColor,
    sensors,
    onBoardDragEnd,
    onDraftBoardDragEnd,
    onMoveRankings,
    onImportRankings,
    onExportRankings,
  } = props;

  const collapsedPeekHeight = 18;
  const initialHeight =
    typeof window === "undefined" ? 340 : Math.min(Math.max(window.innerHeight * 0.42, 180), window.innerHeight - 132);
  const [sheetHeight, setSheetHeight] = useState<number>(initialHeight);
  const [query, setQuery] = useState("");
  const [activePosition, setActivePosition] = useState<"ALL" | Position>("ALL");
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const mobileSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const visibleRankingIds = useMemo(
    () => rankingIds.filter((id) => Boolean(playersById[id])),
    [rankingIds, playersById]
  );
  const availablePositionTabs = useMemo(() => {
    const present = new Set<Position>();
    for (const id of visibleRankingIds) {
      const position = playersById[id]?.position;
      if (position) present.add(position);
    }

    const ordered: Array<"ALL" | Position> = ["ALL", "QB", "RB", "WR", "TE"];
    if (present.has("K")) ordered.push("K");
    if (present.has("DST")) ordered.push("DST");
    return ordered;
  }, [visibleRankingIds, playersById]);
  const positionFilteredRankingIds = useMemo(() => {
    if (activePosition === "ALL") return visibleRankingIds;
    return visibleRankingIds.filter((id) => playersById[id]?.position === activePosition);
  }, [activePosition, visibleRankingIds, playersById]);
  const filteredRankingIds = useMemo(() => {
    const q = normalizeMobileSearch(query);
    if (!q) return positionFilteredRankingIds;

    return positionFilteredRankingIds.filter((id) => {
      const player = playersById[id];
      if (!player) return false;

      const name = normalizeMobileSearch(player.name ?? "");
      const pos = normalizeMobileSearch(player.position ?? "");
      const team = normalizeMobileSearch(player.team ?? "");
      return name.includes(q) || pos.includes(q) || team.includes(q);
    });
  }, [query, positionFilteredRankingIds, playersById]);

  useEffect(() => {
    if (!availablePositionTabs.includes(activePosition)) {
      setActivePosition("ALL");
    }
  }, [activePosition, availablePositionTabs]);

  useEffect(() => {
    const onResize = () => {
      setSheetHeight((prev) => {
        const minHeight = collapsedPeekHeight;
        const maxHeight = Math.max(minHeight + 80, window.innerHeight - 120);
        return Math.min(Math.max(prev, minHeight), maxHeight);
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      const minHeight = collapsedPeekHeight;
      const maxHeight = Math.max(minHeight + 80, window.innerHeight - 120);
      const nextHeight = dragState.startHeight + (dragState.startY - event.clientY);
      setSheetHeight(Math.min(Math.max(nextHeight, minHeight), maxHeight));
    };

    const onPointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const onListDragEnd = (event: DragEndEvent) => {
    if (activePosition !== "ALL") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = rankingIds.indexOf(String(active.id));
    const toIndex = rankingIds.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    onMoveRankings(fromIndex, toIndex);
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          position: "relative",
          zIndex: 12,
          display: "flex",
          gap: 6,
          alignItems: "center",
          justifyContent: "space-between",
          padding: 2,
          borderRadius: 999,
          margin: "8px 8px 0",
        }}
      >
        <div
          style={{
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(38,38,38,0.92)",
            boxShadow: "0 14px 28px rgba(0,0,0,0.32)",
            display: "flex",
            gap: 2,
            alignItems: "center",
            padding: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setBoardTab("Rankings Board")}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: boardTab === "Rankings Board" ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
              background: boardTab === "Rankings Board" ? "rgba(255,255,255,0.1)" : "transparent",
              color: "var(--text-0)",
              fontWeight: 800,
              fontSize: 10,
              lineHeight: "12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Rankings Board
          </button>
          <button
            type="button"
            onClick={() => setBoardTab("Draft Board")}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: boardTab === "Draft Board" ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
              background: boardTab === "Draft Board" ? "rgba(255,255,255,0.1)" : "transparent",
              color: "var(--text-0)",
              fontWeight: 800,
              fontSize: 10,
              lineHeight: "12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Draft Board
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={onImportRankings}
            style={{
              padding: "6px 9px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(38,38,38,0.92)",
              color: "var(--text-0)",
              fontWeight: 800,
              fontSize: 9,
              lineHeight: "11px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 14px 28px rgba(0,0,0,0.32)",
            }}
          >
            Import
          </button>
          <button
            type="button"
            onClick={onExportRankings}
            style={{
              padding: "6px 9px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(38,38,38,0.92)",
              color: "var(--text-0)",
              fontWeight: 800,
              fontSize: 9,
              lineHeight: "11px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 14px 28px rgba(0,0,0,0.32)",
            }}
          >
            Export
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Board
          allowRankingsReorder={false}
          favoriteIds={favoriteIds}
          boardTab={boardTab}
          setBoardTab={setBoardTab}
          rounds={rounds}
          setRounds={setRounds}
          teams={teams}
          setTeams={setTeams}
          onAddPlayer={onAddPlayer}
          draftStyle={draftStyle}
          setDraftStyle={setDraftStyle}
          rankingIds={rankingIds}
          rankingsRankingIds={rankingsRankingIds}
          rankingsTiersByPos={rankingsTiersByPos}
          onUpdateRankingsTiersByPos={onUpdateRankingsTiersByPos}
          playersById={playersById}
          tiersByPos={tiersByPos}
          onUpdateTiersByPos={onUpdateTiersByPos}
          draftedIds={draftedIds}
          onToggleDrafted={onToggleDrafted}
          clearAllDrafted={clearAllDrafted}
          teamNames={teamNames}
          setTeamNames={setTeamNames}
          draftSlots={draftSlots}
          onAssignPlayerToDraftSlot={onAssignPlayerToDraftSlot}
          posColor={posColor}
          sensors={sensors}
          onBoardDragEnd={onBoardDragEnd}
          onDraftBoardDragEnd={onDraftBoardDragEnd}
          availableTabs={["Rankings Board", "Draft Board"]}
          mobileMode
          allowDraftBoardReorder={false}
          showTabSwitcher={false}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: sheetHeight,
          display: "flex",
          flexDirection: "column",
          zIndex: 20,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgb(18,26,61) 0%, rgb(8,12,28) 100%)",
          boxShadow: "0 -24px 50px rgba(0,0,0,0.42)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            height: "100%",
            transform: sheetHeight <= collapsedPeekHeight + 8 ? "translateY(calc(100% - 18px))" : "translateY(0)",
            transition: dragStateRef.current ? "none" : "transform 180ms ease",
          }}
        >
          <div
            onPointerDown={(event) => {
              event.preventDefault();
              dragStateRef.current = { startY: event.clientY, startHeight: sheetHeight };
            }}
            style={{
              padding: "8px 12px 6px",
              touchAction: "none",
              cursor: "ns-resize",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 46,
                height: 5,
                borderRadius: 999,
                background: "rgba(255,255,255,0.28)",
                margin: "0 auto 8px",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players"
              aria-label="Search players"
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                width: "100%",
                padding: "9px 11px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                color: "var(--text-0)",
                outline: "none",
                fontSize: 13,
                fontWeight: 700,
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 5,
                overflowX: "auto",
                marginTop: 8,
                paddingBottom: 2,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {availablePositionTabs.map((tab) => {
                const active = activePosition === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActivePosition(tab)}
                    style={{
                      flex: "0 0 auto",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                      color: "var(--text-0)",
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab === "ALL" ? "All" : tab}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <DndContext sensors={mobileSensors} onDragEnd={onListDragEnd}>
              <SortableContext items={filteredRankingIds} strategy={verticalListSortingStrategy}>
                {filteredRankingIds.map((id, index) => (
                  <MobileRankingRow
                    key={id}
                    id={id}
                    index={index}
                    rank={rankingIds.indexOf(id) + 1}
                    player={playersById[id]}
                    drafted={draftedIds.has(id)}
                    sortable={activePosition === "ALL"}
                    posColor={posColor}
                    onToggleDrafted={onToggleDrafted}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
