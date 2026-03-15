import React, { useMemo } from "react";
import { DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "../models/Player";
import { formatTeamAbbreviation } from "../utils/teamAbbreviation";
import TeamLogo from "./TeamLogo";

export type CompareRankingsColumn = {
  id: string;
  title: string;
  subtitle?: string;
  rankingIds: string[];
  accent: string;
  editable?: boolean;
  removable?: boolean;
  controls?: React.ReactNode;
};

function SortableCompareColumn(props: {
  column: CompareRankingsColumn;
  playersById: Record<string, Player>;
  onMoveMyRanking?: (event: DragEndEvent) => void;
  onRemoveColumn?: (columnId: string) => void;
}) {
  const { column, playersById, onMoveMyRanking, onRemoveColumn } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const columnSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width: 380,
        minWidth: 380,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(14,18,24,0.98)",
        boxShadow: isDragging ? "0 18px 32px rgba(0,0,0,0.24)" : "0 10px 22px rgba(0,0,0,0.16)",
        overflow: "hidden",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 42px 12px 14px",
          cursor: "grab",
          background: `linear-gradient(180deg, ${column.accent}18 0%, rgba(255,255,255,0.02) 100%)`,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 78,
          }}
        >
          <div>
            <div style={{ color: "var(--text-0)", fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>{column.title}</div>
            <div
              style={{
                color: "rgba(255,255,255,0.62)",
                fontSize: 11,
                fontWeight: 800,
                marginTop: 4,
                minHeight: 15,
              }}
            >
              {column.subtitle ?? "\u00A0"}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              minHeight: 29,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            {column.controls ?? <span aria-hidden style={{ display: "block", height: 29 }} />}
          </div>
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.66)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
          }}
        >
          ≡
        </div>

        {column.removable && onRemoveColumn ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveColumn(column.id);
            }}
            title={`Remove ${column.title}`}
            aria-label={`Remove ${column.title}`}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.82)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px minmax(0, 1fr) 50px 52px",
          gap: 10,
          padding: "9px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.62)",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 0.65,
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div>Rank</div>
        <div>Player</div>
        <div>Pos</div>
        <div>Team</div>
      </div>

      <div
        style={{
          padding: "8px 10px 12px",
          overflow: "auto",
          minHeight: 0,
          flex: 1,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {column.editable && onMoveMyRanking ? (
          <DndContext sensors={columnSensors} onDragEnd={onMoveMyRanking}>
            <SortableContext items={column.rankingIds} strategy={verticalListSortingStrategy}>
              {column.rankingIds.map((id, index) => (
                <SortableCompareRankingRow
                  key={id}
                  id={id}
                  rank={index + 1}
                  player={playersById[id]}
                  accent={column.accent}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          column.rankingIds.map((id, index) => (
            <StaticCompareRankingRow
              key={id}
              rank={index + 1}
              player={playersById[id]}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StaticCompareRankingRow(props: {
  rank: number;
  player?: Player;
}) {
  const { rank, player } = props;
  if (!player) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) 50px 52px",
        gap: 10,
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: rank % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.78)", fontWeight: 850, fontSize: 12 }}>{rank}</div>
      <div style={{ minWidth: 0, paddingRight: 6 }}>
        <div
          style={{
            color: "var(--text-0)",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
      </div>
      <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800 }}>{player.position}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TeamLogo
          team={player.team}
          size={18}
          fallback={<div style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: 750 }}>{formatTeamAbbreviation(player.team, "-")}</div>}
        />
      </div>
    </div>
  );
}

function SortableCompareRankingRow(props: {
  id: string;
  rank: number;
  player?: Player;
  accent: string;
}) {
  const { id, rank, player, accent } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  if (!player) return null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) 50px 52px",
        gap: 10,
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: isDragging ? `${accent}18` : rank % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
        boxShadow: isDragging ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
        cursor: "grab",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.78)", fontWeight: 850, fontSize: 12 }}>{rank}</div>
      <div style={{ minWidth: 0, paddingRight: 6 }}>
        <div
          style={{
            color: "var(--text-0)",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
      </div>
      <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 800 }}>{player.position}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TeamLogo
          team={player.team}
          size={18}
          fallback={<div style={{ color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: 750 }}>{formatTeamAbbreviation(player.team, "-")}</div>}
        />
      </div>
    </div>
  );
}

export default function CompareRankingsView(props: {
  columns: CompareRankingsColumn[];
  playersById: Record<string, Player>;
  onImportRankings: () => void;
  onReorderColumns: (fromId: string, toId: string) => void;
  onMoveMyRankings: (fromId: string, toId: string) => void;
  onRemoveColumn: (columnId: string) => void;
}) {
  const { columns, playersById, onImportRankings, onReorderColumns, onMoveMyRankings, onRemoveColumn } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: "var(--text-0)", fontSize: 28, fontWeight: 950, lineHeight: 1.05 }}>Compare Rankings</div>
          <div style={{ color: "rgba(255,255,255,0.64)", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
            Drag list headers to reorder columns. Drag rows only inside My Rankings.
          </div>
        </div>

        <button
          type="button"
          onClick={onImportRankings}
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "11px 16px",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-0)",
            fontWeight: 900,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
          }}
        >
          Import Rankings
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <DndContext
          sensors={sensors}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            onReorderColumns(String(active.id), String(over.id));
          }}
        >
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            <div style={{ display: "flex", gap: 14, alignItems: "stretch", width: "fit-content", minHeight: "100%", margin: "0 auto" }}>
              {columns.map((column) => (
                <SortableCompareColumn
                  key={column.id}
                  column={column}
                  playersById={playersById}
                  onMoveMyRanking={(event) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    onMoveMyRankings(String(active.id), String(over.id));
                  }}
                  onRemoveColumn={onRemoveColumn}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
