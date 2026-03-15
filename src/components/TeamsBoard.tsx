import React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import type { Player, Position } from "../models/Player";
import type { DraftStyle } from "./Board";
import { CellContent } from "./BoardCell";
import TeamLogo from "./TeamLogo";
import { formatTeamAbbreviation } from "../utils/teamAbbreviation";
import { useFitZoomViewport } from "./useFitZoomViewport";

type StarterKey = "QB" | "RB" | "WR" | "TE" | "Flex" | "Superflex" | "K" | "DST";
type StarterConfig = Record<StarterKey, number>;
type SlotInstance = { key: StarterKey; index: number; id: string; label: string };
type TeamOverrideMap = Record<string, string>;
type TeamOverridesState = Record<number, TeamOverrideMap>;
type SlotAssignments = Record<string, Player | undefined>;
type DraftDirection = "left" | "right";

const STARTER_ORDER: StarterKey[] = ["QB", "RB", "WR", "TE", "Flex", "Superflex", "K", "DST"];
const STARTER_LABELS: Record<StarterKey, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  Flex: "Flex",
  Superflex: "Superflex",
  K: "Kicker",
  DST: "Defense",
};

const MOBILE_STARTER_LABELS: Record<StarterKey, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  Flex: "Flex",
  Superflex: "SF",
  K: "K",
  DST: "DEF",
};

const DEFAULT_STARTER_CONFIG: StarterConfig = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  Flex: 1,
  Superflex: 0,
  K: 1,
  DST: 1,
};

function isReverseRound(roundIndex: number, style: DraftStyle) {
  if (style === "Regular Draft") return false;
  if (style === "Snake Draft") return roundIndex % 2 === 1;
  return roundIndex === 1 || (roundIndex >= 2 && roundIndex % 2 === 0);
}

function getTeamIndexForPick(pickIndex: number, teams: number, draftStyle: DraftStyle): number {
  const roundIndex = Math.floor(pickIndex / teams);
  const pickOffset = pickIndex % teams;
  return isReverseRound(roundIndex, draftStyle) ? teams - 1 - pickOffset : pickOffset;
}

function getDraftDirectionForPick(pickIndex: number, teams: number, draftStyle: DraftStyle): DraftDirection | null {
  if (pickIndex < 0 || teams <= 0) return null;
  const roundIndex = Math.floor(pickIndex / teams);
  return isReverseRound(roundIndex, draftStyle) ? "left" : "right";
}

function getNextPickingTeamIndex(draftSlots: (string | null)[], teams: number, draftStyle: DraftStyle): number | null {
  const nextPickIndex = draftSlots.findIndex((playerId) => playerId === null);
  if (nextPickIndex === -1) return null;
  return getTeamIndexForPick(nextPickIndex, teams, draftStyle);
}

function getNextDraftDirection(
  draftSlots: (string | null)[],
  teams: number,
  draftStyle: DraftStyle
): DraftDirection | null {
  const nextPickIndex = draftSlots.findIndex((playerId) => playerId === null);
  if (nextPickIndex === -1) return null;
  return getDraftDirectionForPick(nextPickIndex, teams, draftStyle);
}

function canFillSlot(slot: StarterKey, player: Player): boolean {
  switch (slot) {
    case "QB":
    case "RB":
    case "WR":
    case "TE":
    case "K":
    case "DST":
      return player.position === slot;
    case "Flex":
      return player.position === "RB" || player.position === "WR" || player.position === "TE";
    case "Superflex":
      return player.position === "QB" || player.position === "RB" || player.position === "WR" || player.position === "TE";
    default:
      return false;
  }
}

function buildVisibleStarterSlots(starterConfig: StarterConfig): SlotInstance[] {
  return STARTER_ORDER.flatMap((slot) =>
    Array.from({ length: starterConfig[slot] }, (_, slotIndex) => ({
      key: slot,
      index: slotIndex,
      id: `${slot}-${slotIndex}`,
      label: starterConfig[slot] > 1 ? `${STARTER_LABELS[slot]} ${slotIndex + 1}` : STARTER_LABELS[slot],
    }))
  );
}

function buildTeamRoster(
  playerIds: string[],
  playersById: Record<string, Player>,
  starterConfig: StarterConfig,
  teamOverrides: TeamOverrideMap
): {
  slotAssignments: SlotAssignments;
  bench: Player[];
  playerLocation: Record<string, { kind: "slot"; slotId: string } | { kind: "bench" }>;
} {
  const starters = buildVisibleStarterSlots(starterConfig);
  const availablePlayers = playerIds.map((playerId) => playersById[playerId]).filter((player): player is Player => Boolean(player));
  const availableById = new Map(availablePlayers.map((player) => [player.id, player]));
  const usedPlayerIds = new Set<string>();
  const slotAssignments: SlotAssignments = {};
  const playerLocation: Record<string, { kind: "slot"; slotId: string } | { kind: "bench" }> = {};

  for (const slot of starters) {
    const overridePlayerId = teamOverrides[slot.id];
    const overridePlayer = overridePlayerId ? availableById.get(overridePlayerId) : undefined;
    if (!overridePlayer || usedPlayerIds.has(overridePlayer.id) || !canFillSlot(slot.key, overridePlayer)) continue;
    slotAssignments[slot.id] = overridePlayer;
    playerLocation[overridePlayer.id] = { kind: "slot", slotId: slot.id };
    usedPlayerIds.add(overridePlayer.id);
  }

  for (const slot of starters) {
    if (slotAssignments[slot.id]) continue;

    const fallbackPlayer = availablePlayers.find((player) => !usedPlayerIds.has(player.id) && canFillSlot(slot.key, player));
    if (!fallbackPlayer) continue;

    slotAssignments[slot.id] = fallbackPlayer;
    playerLocation[fallbackPlayer.id] = { kind: "slot", slotId: slot.id };
    usedPlayerIds.add(fallbackPlayer.id);
  }

  const bench = availablePlayers.filter((player) => !usedPlayerIds.has(player.id));
  for (const player of bench) {
    playerLocation[player.id] = { kind: "bench" };
  }

  return { slotAssignments, bench, playerLocation };
}

function buildDragId(teamIndex: number, playerId: string) {
  return `team:${teamIndex}:player:${playerId}`;
}

function buildSlotDropId(teamIndex: number, slotId: string) {
  return `team:${teamIndex}:slot:${slotId}`;
}

function buildBenchDropId(teamIndex: number) {
  return `team:${teamIndex}:bench`;
}

function parseDragId(id: string): { teamIndex: number; playerId: string } | null {
  const match = /^team:(\d+):player:(.+)$/.exec(id);
  if (!match) return null;
  return { teamIndex: Number(match[1]), playerId: match[2] };
}

function parseDropId(id: string): { teamIndex: number; slotId?: string; isBench: boolean } | null {
  const slotMatch = /^team:(\d+):slot:(.+)$/.exec(id);
  if (slotMatch) return { teamIndex: Number(slotMatch[1]), slotId: slotMatch[2], isBench: false };

  const benchMatch = /^team:(\d+):bench$/.exec(id);
  if (benchMatch) return { teamIndex: Number(benchMatch[1]), isBench: true };

  return null;
}

function PlayerChip({
  label,
  player,
  posColor,
  draggableId,
  isDragging = false,
  compactMode = false,
}: {
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
  draggableId?: string;
  isDragging?: boolean;
  compactMode?: boolean;
}) {
  const bg = player ? posColor(player.position) : "var(--surface-0)";
  const displayTeam = React.useMemo(() => formatTeamAbbreviation(player?.team, "FA"), [player?.team]);
  const nameLines = React.useMemo(() => {
    if (!player?.name) return ["", ""];
    const parts = player.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [parts[0] ?? "", ""];
    const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
    const lastPart = parts[parts.length - 1] ?? "";
    if (parts.length >= 3 && suffixes.has(lastPart.toLowerCase())) {
      return [parts.slice(0, -2).join(" "), parts.slice(-2).join(" ")];
    }
    return [parts.slice(0, -1).join(" "), lastPart];
  }, [player?.name]);

  if (compactMode) {
    return (
      <div
        style={{
          boxSizing: "border-box",
          width: 72,
          minWidth: 72,
          height: 48,
          padding: 4,
          position: "relative",
          overflow: "hidden",
          userSelect: "none",
          opacity: isDragging ? 0.82 : 1,
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
            borderRadius: 7,
            background: "rgba(0,0,0,0.1)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 1,
              fontSize: 6,
              lineHeight: 1,
              fontWeight: 700,
              color: "rgba(255,255,255,0.84)",
              letterSpacing: -0.1,
              textAlign: "right",
              maxWidth: 30,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>

          {player?.team ? (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TeamLogo
                team={player.team}
                size={14.0625}
                fallback={<span style={{ fontSize: 6, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{displayTeam}</span>}
              />
            </div>
          ) : null}

          {player ? (
            <>
              <div
                style={{
                  marginTop: 7,
                  paddingRight: 18,
                  fontSize: 7.5,
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
                  marginTop: 4,
                  paddingRight: 8,
                  fontSize: 8,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.97)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  gap: 0,
                  minHeight: 14,
                  overflow: "hidden",
                  letterSpacing: -0.08,
                }}
              >
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameLines[0]}</span>
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameLines[1]}</span>
              </div>
            </>
          ) : (
            <div
              style={{
                marginTop: 7,
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

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 140,
        minWidth: 140,
        padding: 8,
        position: "relative",
        userSelect: "none",
        boxShadow: isDragging ? "0 18px 40px rgba(0,0,0,0.30)" : "0 10px 22px rgba(0,0,0,0.14)",
        overflow: "hidden",
        opacity: isDragging ? 0.96 : 1,
        minHeight: 88,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          right: 0,
          bottom: 6,
          left: 0,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          outline: "1px solid rgba(0,0,0,0.18)",
          background: bg,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          right: 0,
          bottom: 6,
          left: 0,
          borderRadius: 12,
          background: "rgba(0,0,0,0.1)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <CellContent
          label={label}
          name={player?.name ?? "—"}
          position={player?.position ?? " "}
          team={player?.team}
          imageUrl={player?.imageUrl}
          showDash={Boolean(player)}
          showImage
        />
      </div>
    </div>
  );
}

function DraggableTeamCard({
  teamIndex,
  label,
  player,
  posColor,
  compactMode = false,
}: {
  teamIndex: number;
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
  compactMode?: boolean;
}) {
  const dragId = player ? buildDragId(teamIndex, player.id) : undefined;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId ?? `static:${teamIndex}:${label}`,
    disabled: !player,
    data: player ? { teamIndex, playerId: player.id } : undefined,
  });

  return (
    <div
      ref={setNodeRef}
      {...(player ? attributes : {})}
      {...(player ? listeners : {})}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      <PlayerChip label={label} player={player} posColor={posColor} draggableId={dragId} compactMode={compactMode} />
    </div>
  );
}

function TeamStarterSlot({
  teamIndex,
  slotId,
  label,
  player,
  posColor,
  compactMode = false,
}: {
  teamIndex: number;
  slotId: string;
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
  compactMode?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: buildSlotDropId(teamIndex, slotId) });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: compactMode ? 7 : 18,
        boxShadow: isOver ? "0 0 0 2px rgba(255,255,255,0.22)" : undefined,
        background: isOver ? "rgba(255,255,255,0.06)" : undefined,
      }}
    >
      <DraggableTeamCard teamIndex={teamIndex} label={label} player={player} posColor={posColor} compactMode={compactMode} />
    </div>
  );
}

function TeamBenchArea({
  teamIndex,
  bench,
  posColor,
  compactMode = false,
}: {
  teamIndex: number;
  bench: Player[];
  posColor: (pos: Position) => string;
  compactMode?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: buildBenchDropId(teamIndex) });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: compactMode ? 7 : 18,
        padding: compactMode ? 0 : 2,
        boxShadow: isOver ? "0 0 0 2px rgba(255,255,255,0.22)" : undefined,
        background: isOver ? "rgba(255,255,255,0.06)" : undefined,
      }}
    >
      <div style={{ marginBottom: compactMode ? -8 : 4 }}>
        <DraggableTeamCard
          teamIndex={teamIndex}
          label={bench.length ? `Bench${bench.length > 1 ? " 1" : ""}` : "Bench"}
          player={bench[0]}
          posColor={posColor}
          compactMode={compactMode}
        />
      </div>

      {bench.slice(1).map((player, benchIndex) => (
        <div key={`${teamIndex}-bench-${player.id}-${benchIndex}`} style={{ marginBottom: compactMode ? -8 : 4 }}>
          <DraggableTeamCard teamIndex={teamIndex} label={`Bench ${benchIndex + 2}`} player={player} posColor={posColor} compactMode={compactMode} />
        </div>
      ))}
    </div>
  );
}

export default function TeamsBoard(props: {
  teams: number;
  rounds: number;
  draftStyle: DraftStyle;
  draftSlots: (string | null)[];
  teamNames: string[];
  playersById: Record<string, Player>;
  posColor: (pos: Position) => string;
  fitToViewport?: boolean;
}) {
  const { teams, draftStyle, draftSlots, teamNames, playersById, posColor, fitToViewport = false } = props;
  const [starterConfig, setStarterConfig] = React.useState<StarterConfig>(DEFAULT_STARTER_CONFIG);
  const [teamOverrides, setTeamOverrides] = React.useState<TeamOverridesState>({});
  const [activeDrag, setActiveDrag] = React.useState<{ teamIndex: number; player: Player } | null>(null);
  const { viewportRef, contentRef, touchHandlers } = useFitZoomViewport(false);
  const [desktopScale, setDesktopScale] = React.useState(1);

  const visibleStarterSlots = React.useMemo(() => buildVisibleStarterSlots(starterConfig), [starterConfig]);
  const nextPickingTeamIndex = React.useMemo(
    () => getNextPickingTeamIndex(draftSlots, teams, draftStyle),
    [draftSlots, teams, draftStyle]
  );
  const nextDraftDirection = React.useMemo(
    () => getNextDraftDirection(draftSlots, teams, draftStyle),
    [draftSlots, teams, draftStyle]
  );

  const teamPlayerIds = React.useMemo(() => {
    const grouped = Array.from({ length: teams }, () => [] as string[]);
    draftSlots.forEach((playerId, pickIndex) => {
      if (!playerId) return;
      const teamIndex = getTeamIndexForPick(pickIndex, teams, draftStyle);
      grouped[teamIndex]?.push(playerId);
    });
    return grouped;
  }, [draftSlots, teams, draftStyle]);

  React.useEffect(() => {
    setTeamOverrides((prev) => {
      const next: TeamOverridesState = {};
      let changed = false;

      teamPlayerIds.forEach((playerIds, teamIndex) => {
        const prevTeamOverrides = prev[teamIndex] ?? {};
        const playerIdSet = new Set(playerIds);
        const validSlotIds = new Set(visibleStarterSlots.map((slot) => slot.id));
        const filteredEntries = Object.entries(prevTeamOverrides).filter(([slotId, playerId]) => {
          if (!validSlotIds.has(slotId)) return false;
          if (!playerIdSet.has(playerId)) return false;
          const player = playersById[playerId];
          const slotKey = visibleStarterSlots.find((slot) => slot.id === slotId)?.key;
          return Boolean(player && slotKey && canFillSlot(slotKey, player));
        });

        if (filteredEntries.length > 0) {
          next[teamIndex] = Object.fromEntries(filteredEntries);
        }

        if (filteredEntries.length !== Object.keys(prevTeamOverrides).length) {
          changed = true;
        }
      });

      if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
      return next;
    });
  }, [teamPlayerIds, visibleStarterSlots, playersById]);

  const teamRosters = React.useMemo(
    () =>
      teamPlayerIds.map((playerIds, teamIndex) =>
        buildTeamRoster(playerIds, playersById, starterConfig, teamOverrides[teamIndex] ?? {})
      ),
    [teamPlayerIds, playersById, starterConfig, teamOverrides]
  );

  const selectStyle: React.CSSProperties = {
    borderRadius: fitToViewport ? 8 : 10,
    border: "1px solid var(--border-0)",
    background: "var(--panel-bg-2)",
    color: "var(--text-0)",
    padding: fitToViewport ? "2px 4px" : "6px 10px",
    outline: "none",
    fontWeight: 750,
    fontSize: fitToViewport ? 10 : 14,
  };

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const parsed = parseDragId(String(event.active.id));
      if (!parsed) {
        setActiveDrag(null);
        return;
      }

      const player = playersById[parsed.playerId];
      if (!player) {
        setActiveDrag(null);
        return;
      }

      setActiveDrag({ teamIndex: parsed.teamIndex, player });
    },
    [playersById]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const active = parseDragId(String(event.active.id));
      const over = event.over ? parseDropId(String(event.over.id)) : null;
      setActiveDrag(null);

      if (!active || !over) return;
      if (active.teamIndex !== over.teamIndex) return;

      const roster = teamRosters[active.teamIndex];
      const activePlayer = playersById[active.playerId];
      if (!roster || !activePlayer) return;

      const sourceLocation = roster.playerLocation[active.playerId];
      if (!sourceLocation) return;

      const overSlotId = over.slotId;

      if (!over.isBench && overSlotId) {
        const targetSlot = visibleStarterSlots.find((slot) => slot.id === overSlotId);
        if (!targetSlot || !canFillSlot(targetSlot.key, activePlayer)) return;

        const targetPlayer = roster.slotAssignments[overSlotId];
        const sourceSlotId = sourceLocation.kind === "slot" ? sourceLocation.slotId : undefined;

        setTeamOverrides((prev) => {
          const nextTeamOverrides = { ...(prev[active.teamIndex] ?? {}) };

          Object.keys(nextTeamOverrides).forEach((slotId) => {
            if (nextTeamOverrides[slotId] === active.playerId) delete nextTeamOverrides[slotId];
          });

          nextTeamOverrides[overSlotId] = active.playerId;

          if (sourceSlotId && sourceSlotId !== overSlotId) {
            delete nextTeamOverrides[sourceSlotId];

            if (targetPlayer && targetPlayer.id !== active.playerId) {
              nextTeamOverrides[sourceSlotId] = targetPlayer.id;
            }
          }

          return {
            ...prev,
            [active.teamIndex]: nextTeamOverrides,
          };
        });

        return;
      }

      if (over.isBench) {
        if (sourceLocation.kind !== "slot") return;

        setTeamOverrides((prev) => {
          const nextTeamOverrides = { ...(prev[active.teamIndex] ?? {}) };
          delete nextTeamOverrides[sourceLocation.slotId];

          return {
            ...prev,
            [active.teamIndex]: nextTeamOverrides,
          };
        });
      }
    },
    [playersById, teamRosters, visibleStarterSlots]
  );

  React.useLayoutEffect(() => {
    if (fitToViewport) {
      setDesktopScale(1);
      return;
    }

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const update = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      if (viewportRect.width <= 0 || contentRect.width <= 0) return;

      const naturalWidth = contentRect.width / desktopScale;
      if (naturalWidth <= 0) return;

      const nextScale = Math.max(0.68, Math.min(1.28, (viewportRect.width - 8) / naturalWidth));
      setDesktopScale((prev) => (Math.abs(prev - nextScale) < 0.01 ? prev : nextScale));
    };

    update();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(viewport);
    ro.observe(content);
    return () => ro.disconnect();
  }, [fitToViewport, teams, draftSlots, starterConfig, desktopScale, contentRef, viewportRef]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <div
          style={{
            display: fitToViewport ? "grid" : "flex",
            gridTemplateColumns: fitToViewport ? "repeat(8, minmax(0, 1fr))" : undefined,
            flexWrap: fitToViewport ? undefined : "wrap",
            gap: fitToViewport ? 4 : 10,
            padding: fitToViewport ? 6 : 12,
            borderRadius: fitToViewport ? 14 : 16,
            border: fitToViewport ? "none" : "1px solid rgba(255,255,255,0.10)",
            outline: fitToViewport ? "none" : "1px solid rgba(0,0,0,0.18)",
            background: fitToViewport ? "transparent" : "var(--panel-bg)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {STARTER_ORDER.map((slot) => (
            <label
              key={slot}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: fitToViewport ? "center" : undefined,
                gap: fitToViewport ? 4 : 8,
                padding: fitToViewport ? "2px 4px" : "6px 10px",
                borderRadius: fitToViewport ? 8 : 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                fontSize: fitToViewport ? 9 : 12,
                fontWeight: 800,
                color: "var(--text-0)",
                minWidth: 0,
                flexDirection: fitToViewport ? "column" : "row",
              }}
            >
              <span style={{ whiteSpace: "nowrap", overflow: fitToViewport ? "hidden" : undefined, textOverflow: fitToViewport ? "ellipsis" : undefined, lineHeight: 1 }}>
                {fitToViewport ? MOBILE_STARTER_LABELS[slot] : STARTER_LABELS[slot]}
              </span>
              <select
                value={starterConfig[slot]}
                onChange={(e) =>
                  setStarterConfig((prev) => ({
                    ...prev,
                    [slot]: Number(e.target.value),
                  }))
                }
                style={selectStyle}
                aria-label={`${STARTER_LABELS[slot]} starters`}
              >
                {Array.from({ length: 7 }, (_, idx) => idx).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div
          ref={viewportRef}
          {...touchHandlers}
          style={{
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "visible",
            touchAction: fitToViewport ? "pan-x pan-y" : undefined,
          }}
        >
          <div
            ref={contentRef}
            style={{
              width: "fit-content",
              zoom: fitToViewport ? undefined : desktopScale,
            }}
          >
            <div style={{ display: "flex", overflowX: "visible", paddingTop: 4, paddingRight: 4, paddingBottom: 4, paddingLeft: 4 }}>
              {Array.from({ length: teams }).map((_, teamIndex) => {
            const teamName = teamNames[teamIndex]?.trim() || `Team ${teamIndex + 1}`;
            const roster = teamRosters[teamIndex];
            const isNextPickingTeam = nextPickingTeamIndex === teamIndex;
            const showLeftArrow = isNextPickingTeam && nextDraftDirection === "left";
            const showRightArrow = isNextPickingTeam && nextDraftDirection === "right";

            return (
              <div
                key={`${teamIndex}-${teamName}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginRight: fitToViewport ? 1 : 4,
                  borderRadius: fitToViewport ? 7 : 18,
                  padding: fitToViewport ? 0 : 0,
                  background: isNextPickingTeam ? "rgba(255, 215, 0, 0.12)" : undefined,
                  boxShadow: isNextPickingTeam ? "0 0 0 2px rgba(255, 215, 0, 0.38)" : undefined,
                }}
              >
                <div
                  style={{
                    width: fitToViewport ? 72 : 140,
                    minWidth: fitToViewport ? 72 : 140,
                    minHeight: fitToViewport ? 14 : 18,
                    marginRight: fitToViewport ? 1 : 0,
                    marginBottom: fitToViewport ? 2 : 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: fitToViewport ? 2 : 6,
                    fontSize: fitToViewport ? 6 : 11,
                    fontWeight: 900,
                    letterSpacing: fitToViewport ? 0.2 : 0.6,
                    textTransform: "uppercase",
                    color: "rgba(255, 235, 140, 0.98)",
                    whiteSpace: "nowrap",
                    visibility: isNextPickingTeam ? "visible" : "hidden",
                  }}
                >
                  {showLeftArrow ? <span aria-hidden>←</span> : null}
                  <span>On the Clock</span>
                  {showRightArrow ? <span aria-hidden>→</span> : null}
                </div>

                <div
                  style={{
                    boxSizing: "border-box",
                    width: fitToViewport ? 72 : 140,
                    minWidth: fitToViewport ? 72 : 140,
                    minHeight: fitToViewport ? 28 : undefined,
                    marginRight: fitToViewport ? 1 : 0,
                    marginBottom: fitToViewport ? 2 : 4,
                    borderRadius: fitToViewport ? 7 : 16,
                    border: isNextPickingTeam
                      ? "1px solid rgba(255,215,0,0.55)"
                      : "1px solid rgba(255,255,255,0.10)",
                    outline: isNextPickingTeam
                      ? "1px solid rgba(255,215,0,0.32)"
                      : "1px solid rgba(0,0,0,0.18)",
                    background: isNextPickingTeam ? "rgba(255, 215, 0, 0.18)" : "var(--panel-bg)",
                    padding: fitToViewport ? 0 : 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      fontSize: fitToViewport ? 9 : 15,
                      fontWeight: fitToViewport ? 800 : 900,
                      color: "var(--text-0)",
                      lineHeight: 1.1,
                      wordBreak: "break-word",
                      textAlign: "center",
                      padding: 0,
                    }}
                    title={teamName}
                  >
                    {teamName}
                  </div>
                </div>

                {visibleStarterSlots.map((slot) => (
                  <div key={`${teamIndex}-${slot.id}`} style={{ marginBottom: fitToViewport ? -8 : 4 }}>
                    <TeamStarterSlot
                      teamIndex={teamIndex}
                      slotId={slot.id}
                      label={slot.label}
                      player={roster?.slotAssignments[slot.id]}
                      posColor={posColor}
                      compactMode={fitToViewport}
                    />
                  </div>
                ))}

                <TeamBenchArea teamIndex={teamIndex} bench={roster?.bench ?? []} posColor={posColor} compactMode={fitToViewport} />
              </div>
            );
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? (
          <PlayerChip label={activeDrag.player.position} player={activeDrag.player} posColor={posColor} isDragging compactMode={fitToViewport} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
