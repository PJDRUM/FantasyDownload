import React, { useMemo } from "react";
import { DndContext, PointerSensor, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "../models/Player";

export type CompareRankingsColumn = {
  id: string;
  title: string;
  subtitle?: string;
  rankingIds: string[];
  accent: string;
  editable?: boolean;
  removable?: boolean;
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
        width: 320,
        minWidth: 320,
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(18,22,30,0.98) 0%, rgba(11,15,21,0.98) 100%)",
        boxShadow: isDragging ? "0 22px 42px rgba(0,0,0,0.3)" : "0 16px 34px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          cursor: "grab",
          background: `linear-gradient(135deg, ${column.accent}22 0%, rgba(255,255,255,0.03) 100%)`,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text-0)", fontSize: 18, fontWeight: 950, lineHeight: 1.1 }}>{column.title}</div>
          {column.subtitle ? (
            <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: 800, marginTop: 4 }}>{column.subtitle}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.82)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              ×
            </button>
          ) : null}

          <div
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
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
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "48px 1fr",
          gap: 8,
          padding: "10px 16px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.62)",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        <div>Rank</div>
        <div>Player</div>
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
        gridTemplateColumns: "48px 1fr",
        gap: 8,
        alignItems: "center",
        padding: "10px 10px",
        marginBottom: 6,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.82)", fontWeight: 900, fontSize: 13 }}>{rank}</div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--text-0)",
            fontSize: 14,
            fontWeight: 850,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 750, marginTop: 3 }}>
          {player.position}{player.team ? ` • ${player.team}` : ""}
        </div>
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
        gridTemplateColumns: "48px 1fr",
        gap: 8,
        alignItems: "center",
        padding: "10px 10px",
        marginBottom: 6,
        borderRadius: 14,
        border: isDragging ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.06)",
        background: isDragging ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        boxShadow: isDragging ? "0 14px 30px rgba(0,0,0,0.22)" : "none",
        cursor: "grab",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.82)", fontWeight: 900, fontSize: 13 }}>{rank}</div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--text-0)",
            fontSize: 14,
            fontWeight: 850,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 750, marginTop: 3 }}>
          {player.position}{player.team ? ` • ${player.team}` : ""}
        </div>
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
            <div style={{ display: "flex", gap: 14, alignItems: "stretch", width: "fit-content", minHeight: "100%" }}>
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
