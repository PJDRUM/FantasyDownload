import React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import type { Player, Position } from "../models/Player";
import type { DraftStyle } from "./Board";

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

function abbreviatePlayerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts[0].slice(0, 1).toUpperCase()}. ${parts.slice(1).join(" ")}`.trim();
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
}: {
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
  draggableId?: string;
  isDragging?: boolean;
}) {
  const bg = player ? posColor(player.position) : "var(--surface-0)";

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 140,
        minWidth: 140,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        outline: "1px solid rgba(0,0,0,0.18)",
        background: bg,
        padding: 8,
        position: "relative",
        userSelect: "none",
        boxShadow: isDragging ? "0 18px 40px rgba(0,0,0,0.30)" : "0 10px 22px rgba(0,0,0,0.14)",
        overflow: "hidden",
        opacity: isDragging ? 0.96 : 1,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          background: "rgba(0,0,0,0.14)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85, textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}>
          {label}
        </div>

        {player ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: draggableId ? "grab" : "default",
              touchAction: draggableId ? "none" : "auto",
            }}
          >
            <img
              src={player.imageUrl || "/headshot-placeholder.svg"}
              alt={player.name}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                objectFit: "cover",
                border: "1px solid rgba(0,0,0,0.15)",
                background: "rgba(255,255,255,0.35)",
                flexShrink: 0,
              }}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (!img.src.includes("/headshot-placeholder.svg")) {
                  img.src = "/headshot-placeholder.svg";
                }
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 14,
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                }}
                title={player.name}
              >
                {abbreviatePlayerName(player.name)}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 12,
                  opacity: 0.85,
                  textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={player.team ?? ""}
              >
                {player.position}
                {player.team ? ` — ${player.team}` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              minHeight: 34,
              display: "flex",
              alignItems: "center",
              fontWeight: 800,
              fontSize: 12,
              opacity: 0.65,
              textShadow: "0 1px 2px rgba(0,0,0,0.45)",
            }}
          >
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTeamCard({
  teamIndex,
  label,
  player,
  posColor,
}: {
  teamIndex: number;
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
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
      <PlayerChip label={label} player={player} posColor={posColor} draggableId={dragId} />
    </div>
  );
}

function TeamStarterSlot({
  teamIndex,
  slotId,
  label,
  player,
  posColor,
}: {
  teamIndex: number;
  slotId: string;
  label: string;
  player?: Player;
  posColor: (pos: Position) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: buildSlotDropId(teamIndex, slotId) });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 18,
        boxShadow: isOver ? "0 0 0 2px rgba(255,255,255,0.22)" : undefined,
        background: isOver ? "rgba(255,255,255,0.06)" : undefined,
      }}
    >
      <DraggableTeamCard teamIndex={teamIndex} label={label} player={player} posColor={posColor} />
    </div>
  );
}

function TeamBenchArea({
  teamIndex,
  bench,
  posColor,
}: {
  teamIndex: number;
  bench: Player[];
  posColor: (pos: Position) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: buildBenchDropId(teamIndex) });

  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 18,
        padding: 2,
        boxShadow: isOver ? "0 0 0 2px rgba(255,255,255,0.22)" : undefined,
        background: isOver ? "rgba(255,255,255,0.06)" : undefined,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <DraggableTeamCard
          teamIndex={teamIndex}
          label={bench.length ? `Bench${bench.length > 1 ? " 1" : ""}` : "Bench"}
          player={bench[0]}
          posColor={posColor}
        />
      </div>

      {bench.slice(1).map((player, benchIndex) => (
        <div key={`${teamIndex}-bench-${player.id}-${benchIndex}`} style={{ marginBottom: 4 }}>
          <DraggableTeamCard teamIndex={teamIndex} label={`Bench ${benchIndex + 2}`} player={player} posColor={posColor} />
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
}) {
  const { teams, draftStyle, draftSlots, teamNames, playersById, posColor } = props;
  const [starterConfig, setStarterConfig] = React.useState<StarterConfig>(DEFAULT_STARTER_CONFIG);
  const [teamOverrides, setTeamOverrides] = React.useState<TeamOverridesState>({});
  const [activeDrag, setActiveDrag] = React.useState<{ teamIndex: number; player: Player } | null>(null);

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
    borderRadius: 10,
    border: "1px solid var(--border-0)",
    background: "var(--panel-bg-2)",
    color: "var(--text-0)",
    padding: "6px 10px",
    outline: "none",
    fontWeight: 750,
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

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: 12,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            outline: "1px solid rgba(0,0,0,0.18)",
            background: "var(--panel-bg)",
          }}
        >
          {STARTER_ORDER.map((slot) => (
            <label
              key={slot}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                fontSize: 12,
                fontWeight: 800,
                color: "var(--text-0)",
              }}
            >
              <span>{STARTER_LABELS[slot]}</span>
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

        <div style={{ display: "flex", overflowX: "auto", paddingTop: 4, paddingRight: 4, paddingBottom: 4, paddingLeft: 4 }}>
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
                  marginRight: 4,
                  borderRadius: 18,
                  padding: 4,
                  background: isNextPickingTeam ? "rgba(255, 215, 0, 0.12)" : undefined,
                  boxShadow: isNextPickingTeam ? "0 0 0 2px rgba(255, 215, 0, 0.38)" : undefined,
                }}
              >
                <div
                  style={{
                    width: 140,
                    minWidth: 140,
                    minHeight: 18,
                    marginRight: 4,
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 0.6,
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
                    width: 140,
                    minWidth: 140,
                    marginRight: 4,
                    marginBottom: 4,
                    borderRadius: 16,
                    border: isNextPickingTeam
                      ? "1px solid rgba(255,215,0,0.55)"
                      : "1px solid rgba(255,255,255,0.10)",
                    outline: isNextPickingTeam
                      ? "1px solid rgba(255,215,0,0.32)"
                      : "1px solid rgba(0,0,0,0.18)",
                    background: isNextPickingTeam ? "rgba(255, 215, 0, 0.18)" : "var(--panel-bg)",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      fontSize: 15,
                      fontWeight: 900,
                      color: "var(--text-0)",
                      lineHeight: 1.1,
                      wordBreak: "break-word",
                    }}
                    title={teamName}
                  >
                    {teamName}
                  </div>
                </div>

                {visibleStarterSlots.map((slot) => (
                  <div key={`${teamIndex}-${slot.id}`} style={{ marginBottom: 4 }}>
                    <TeamStarterSlot
                      teamIndex={teamIndex}
                      slotId={slot.id}
                      label={slot.label}
                      player={roster?.slotAssignments[slot.id]}
                      posColor={posColor}
                    />
                  </div>
                ))}

                <TeamBenchArea teamIndex={teamIndex} bench={roster?.bench ?? []} posColor={posColor} />
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeDrag ? (
            <PlayerChip label={activeDrag.player.position} player={activeDrag.player} posColor={posColor} isDragging />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
