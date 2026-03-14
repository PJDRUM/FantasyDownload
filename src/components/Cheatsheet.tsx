// src/components/Cheatsheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Position, Player } from "../models/Player";
import type { TiersByPos } from "../utils/xlsxRankings";
import { useFitZoomViewport } from "./useFitZoomViewport";

function getPlayerRankValue(p: Player | undefined | null): number {
  if (!p) return Number.POSITIVE_INFINITY;

  // Prefer a "Rank" field if present. Fall back through a few common names.
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
  tierBreaks: string[]; // playerIds that START a new tier (Tier 2+)
}): { tier: number; ids: string[] }[] {
  const { pos, rankingIds, playersById, tierBreaks } = args;

  // NOTE: rankingIds may be ADP-ordered upstream; within each position we want to display
  // players ordered by Rank (ascending). If Rank is missing, fall back to the incoming order.
  const indexById = new Map<string, number>();
  rankingIds.forEach((id, idx) => indexById.set(id, idx));

  const ids = rankingIds
    .filter((id) => playersById[id]?.position === pos)
    .slice()
    .sort((a, b) => {
      const ra = getPlayerRankValue(playersById[a]);
      const rb = getPlayerRankValue(playersById[b]);
      if (ra !== rb) return ra - rb;

      // Stable fallback: preserve the original list order.
      const ia = indexById.get(a) ?? 0;
      const ib = indexById.get(b) ?? 0;
      if (ia !== ib) return ia - ib;

      // Final tie-breaker.
      const na = playersById[a]?.name ?? "";
      const nb = playersById[b]?.name ?? "";
      return na.localeCompare(nb);
    });

  const breakSet = new Set(tierBreaks ?? []);

  const tiers: { tier: number; ids: string[] }[] = [];
  let currentTier = 1;
  let current: string[] = [];

  for (const id of ids) {
    if (breakSet.has(id) && current.length > 0) {
      tiers.push({ tier: currentTier, ids: current });
      currentTier += 1;
      current = [];
    }
    current.push(id);
  }

  if (current.length > 0) tiers.push({ tier: currentTier, ids: current });
  return tiers;
}

function buildUdkPosRankById(args: { rankingsRankingIds: string[]; playersById: Record<string, Player> }): Record<string, number> {
  const { rankingsRankingIds, playersById } = args;

  const counters: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  const out: Record<string, number> = {};

  for (const id of rankingsRankingIds) {
    const p = playersById[id];
    if (!p) continue;
    const pos = p.position;
    counters[pos] += 1;
    out[id] = counters[pos];
  }

  return out;
}

const POS_LABEL: Record<Position, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
  K: "Kickers",
  DST: "Defense",
};

type TierBlock = { id: string; playerIds: string[] };

export default function Cheatsheet(props: {
  favoriteIds: Set<string>;
  rankingIds: string[];
  // Used to compute the position-rank numbers shown before each player name.
  // If not provided, falls back to `rankingIds`.
  rankingsRankingIds?: string[];

  playersById: Record<string, Player>;
  tiersByPos: TiersByPos;
  onUpdateTiersByPos?: (pos: Position, tierBreaks: string[]) => void;

  draftedIds: Set<string>;
  onToggleDrafted: (id: string) => void;
  allowDraftToggle?: boolean;

  posColor: (pos: Position) => string;
  fitToViewport?: boolean;
}) {
  const {
    favoriteIds,
    rankingIds,
    rankingsRankingIds,
    playersById,
    tiersByPos,
    onUpdateTiersByPos,
    draftedIds,
    onToggleDrafted,
    allowDraftToggle = true,
    posColor,
    fitToViewport = false,
  } = props;
  const { viewportRef, contentRef, contentSize, totalScale, touchHandlers } = useFitZoomViewport(fitToViewport);

  const primaryRankingIds = useMemo(() => {
    return (rankingsRankingIds && rankingsRankingIds.length ? rankingsRankingIds : rankingIds) ?? [];
  }, [rankingsRankingIds, rankingIds]);

  const positions: Position[] = useMemo(() => {
    const present = new Set<Position>();
    for (const id of primaryRankingIds) {
      const p = playersById[id];
      if (p) present.add(p.position);
    }
    const order: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
    return order.filter((pos) => present.has(pos));
  }, [primaryRankingIds, playersById]);

  const udkPosRankById = useMemo(() => {
    const ids = (rankingsRankingIds && rankingsRankingIds.length ? rankingsRankingIds : rankingIds) ?? [];
    return buildUdkPosRankById({ rankingsRankingIds: ids, playersById });
  }, [rankingsRankingIds, rankingIds, playersById]);

  const computedTierBlocksByPos = useMemo(() => {
    const out: Record<string, TierBlock[]> = {};
    for (const pos of positions) {
      const tiers = buildTiersForPos({
        pos,
        rankingIds: primaryRankingIds,
        playersById,
        tierBreaks: tiersByPos[pos] ?? [],
      });
      out[pos] = tiers.map((t, i) => ({
        id: `${pos}-tier-${i}-${t.ids[0] ?? "empty"}`,
        playerIds: [...t.ids],
      }));
      if (out[pos].length === 0) out[pos] = [{ id: `${pos}-tier-0-empty`, playerIds: [] }];
    }
    return out as Record<Position, TierBlock[]>;
  }, [positions, primaryRankingIds, playersById, tiersByPos]);

  const [tierBlocksByPos, setTierBlocksByPos] = useState<Record<Position, TierBlock[]>>(() => computedTierBlocksByPos);

  useEffect(() => {
    setTierBlocksByPos(computedTierBlocksByPos);
  }, [computedTierBlocksByPos]);

  function commitTierBreaks(pos: Position, blocks: TierBlock[]) {
    if (!onUpdateTiersByPos) return;
    const breaks: string[] = [];
    for (let i = 1; i < blocks.length; i++) {
      const first = blocks[i]?.playerIds?.[0];
      if (first) breaks.push(first);
    }
    onUpdateTiersByPos(pos, breaks);
  }

  function nudgeTierBar(pos: Position, idx: number, direction: "up" | "down") {
    setTierBlocksByPos((prev) => {
      const blocks = (prev[pos] ?? []).map((b) => ({ ...b, playerIds: [...b.playerIds] }));
      if (blocks.length <= 1) return prev;
      if (idx <= 0 || idx >= blocks.length) return prev;

      const prevTier = blocks[idx - 1];
      const curTier = blocks[idx];
      if (!prevTier || !curTier) return prev;

      if (direction === "up") {
        if (prevTier.playerIds.length <= 1) return prev;
        const moved = prevTier.playerIds.pop();
        if (!moved) return prev;
        curTier.playerIds.unshift(moved);
      } else {
        if (curTier.playerIds.length <= 1) return prev;
        const moved = curTier.playerIds.shift();
        if (!moved) return prev;
        prevTier.playerIds.push(moved);
      }

      commitTierBreaks(pos, blocks);
      return { ...prev, [pos]: blocks };
    });
  }

  return (
    <div
      ref={viewportRef}
      {...touchHandlers}
      style={{
        boxSizing: "border-box",
        width: fitToViewport ? "100%" : "fit-content",
        maxWidth: "100%",
        paddingTop: 8,
        overflow: fitToViewport ? "auto" : "visible",
        touchAction: fitToViewport ? "pan-x pan-y" : undefined,
      }}
    >
      <div
        style={
          fitToViewport
            ? {
                width: contentSize.width ? contentSize.width * totalScale : "100%",
                height: contentSize.height ? contentSize.height * totalScale : "auto",
              }
            : undefined
        }
      >
        <div
          ref={contentRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${positions.length}, 280px)`,
            gap: 10,
            alignItems: "start",
            width: "fit-content",
            transform: fitToViewport ? `scale(${totalScale})` : undefined,
            transformOrigin: fitToViewport ? "top left" : undefined,
          }}
        >
        {positions.map((pos) => {
          const tierColor = posColor(pos);
          const tierBlocks = tierBlocksByPos[pos] ?? [];

          const addTier = () => {
            setTierBlocksByPos((prev) => {
              const blocks = [...(prev[pos] ?? [])].map((b) => ({ ...b, playerIds: [...b.playerIds] }));
              if (blocks.length === 0) return { ...prev, [pos]: [{ id: `${pos}-tier-0-empty`, playerIds: [] }] };

              const lastIdx = blocks.length - 1;
              const last = blocks[lastIdx];

              if (last.playerIds.length >= 2) {
                const first = last.playerIds[0];
                const rest = last.playerIds.slice(1);
                last.playerIds = [first];
                blocks[lastIdx] = last;
                blocks.splice(lastIdx + 1, 0, { id: `${pos}-tier-${blocks.length}-${rest[0] ?? "empty"}`, playerIds: rest });
              } else {
                blocks.splice(lastIdx + 1, 0, { id: `${pos}-tier-${blocks.length}-empty`, playerIds: [] });
              }

              commitTierBreaks(pos, blocks);
              return { ...prev, [pos]: blocks };
            });
          };

          const removeTier = () => {
            setTierBlocksByPos((prev) => {
              const blocks = [...(prev[pos] ?? [])].map((b) => ({ ...b, playerIds: [...b.playerIds] }));
              if (blocks.length <= 1) return prev;

              const last = blocks.pop()!;
              const prevLast = blocks[blocks.length - 1];
              const merged = { ...prevLast, playerIds: [...prevLast.playerIds, ...last.playerIds] };
              blocks[blocks.length - 1] = merged;

              commitTierBreaks(pos, blocks);
              return { ...prev, [pos]: blocks };
            });
          };

          return (
            <div
              key={pos}
              style={{
                boxSizing: "border-box",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "linear-gradient(180deg, rgba(24,29,36,0.96) 0%, rgba(14,18,24,0.98) 100%)",
                overflow: "hidden",
                boxShadow: "0 16px 32px rgba(0,0,0,0.24)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "12px 12px 10px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background: `linear-gradient(135deg, ${tierColor}22 0%, rgba(255,255,255,0.02) 100%)`,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span
                    style={{
                      color: "var(--text-0)",
                      fontSize: 18,
                      fontWeight: 950,
                      lineHeight: 1,
                    }}
                  >
                    {POS_LABEL[pos]}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={addTier}
                    title="Add tier"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#ffffff",
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={removeTier}
                    title="Remove tier"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#ffffff",
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                </div>
              </div>

              <div style={{ padding: 10 }}>
                {tierBlocks.map((block, idx) => {
                  const isTierOne = idx === 0;
                  const prevTier = idx > 0 ? tierBlocks[idx - 1] : null;

                  const canMoveUp = !isTierOne && !!prevTier && (prevTier.playerIds?.length ?? 0) > 1;
                  const canMoveDown = !isTierOne && (block.playerIds?.length ?? 0) > 1;

                  return (
                    <div key={block.id} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 0,
                          borderRadius: 10,
                          overflow: "hidden",
                          background: `linear-gradient(90deg, ${tierColor}f0 0%, ${tierColor}c8 100%)`,
                          border: "1px solid rgba(255,255,255,0.08)",
                          fontWeight: 900,
                          fontSize: 10,
                          letterSpacing: 0.45,
                          color: "#ffffff",
                          boxShadow: "0 6px 14px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.12)",
                          userSelect: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "5px 9px",
                            textTransform: "uppercase",
                            textShadow: "0 1px 2px rgba(0,0,0,0.22)",
                          }}
                        >
                          Tier {idx + 1}
                        </span>

                        {!isTierOne && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 5px 3px 8px",
                              background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(0,0,0,0.14) 32%)",
                            }}
                          >
                            <button
                              type="button"
                              aria-label="Move tier bar up"
                              title={canMoveUp ? "Move tier bar up" : "Need 2+ players in previous tier"}
                              disabled={!canMoveUp}
                              onClick={() => nudgeTierBar(pos, idx, "up")}
                              style={{
                                all: "unset",
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: canMoveUp ? "pointer" : "not-allowed",
                                opacity: canMoveUp ? 1 : 0.35,
                                background: "rgba(255,255,255,0.14)",
                                border: "1px solid rgba(255,255,255,0.18)",
                                lineHeight: 1,
                                fontSize: 8,
                                fontWeight: 900,
                                userSelect: "none",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label="Move tier bar down"
                              title={canMoveDown ? "Move tier bar down" : "Need 2+ players in this tier"}
                              disabled={!canMoveDown}
                              onClick={() => nudgeTierBar(pos, idx, "down")}
                              style={{
                                all: "unset",
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: canMoveDown ? "pointer" : "not-allowed",
                                opacity: canMoveDown ? 1 : 0.35,
                                background: "rgba(255,255,255,0.14)",
                                border: "1px solid rgba(255,255,255,0.18)",
                                lineHeight: 1,
                                fontSize: 8,
                                fontWeight: 900,
                                userSelect: "none",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.14)",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              ▼
                            </button>
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 6 }}>
                        {block.playerIds.length === 0 ? (
                          <div
                            style={{
                              padding: "6px 8px",
                              borderRadius: 10,
                              border: "1px dashed rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.58)",
                              fontSize: 12,
                              fontWeight: 650,
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            Empty tier
                          </div>
                        ) : (
                          block.playerIds.map((id) => {
                            const p = playersById[id];
                            if (!p) return null;

                            const drafted = draftedIds.has(id);
                            const posRank = udkPosRankById[id] ?? 0;
                            const bye = (p as any).bye ?? (p as any).byeWeek ?? (p as any).bye_week;

                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={allowDraftToggle ? () => onToggleDrafted(id) : undefined}
                                title={allowDraftToggle ? (drafted ? "Undraft player" : "Draft player") : undefined}
                                style={{
                                  all: "unset",
                                  display: "grid",
                                  gridTemplateColumns: "46px 1fr",
                                  gap: 8,
                                  alignItems: "center",
                                  padding: "4px 2px",
                                  cursor: allowDraftToggle ? "pointer" : "default",
                                  opacity: drafted ? 0.35 : 1,
                                  textDecoration: drafted ? "line-through" : "none",
                                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    opacity: 0.8,
                                  }}
                                >
                                  {favoriteIds.has(id) && (
                                    <span aria-hidden style={{ fontSize: 12, lineHeight: 1, color: "#fbbf24" }}>
                                      ★
                                    </span>
                                  )}
                                  <span style={{ minWidth: 16, textAlign: "right" }}>{posRank || "-"}</span>
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 850,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {p.name}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                      {p.team ? (
                                        <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 750, whiteSpace: "nowrap" }}>{p.team}</span>
                                      ) : null}
                                      {p.age != null ? (
                                        <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 750, whiteSpace: "nowrap" }}>{p.age}</span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {bye ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginTop: 1,
                                        fontSize: 11,
                                        opacity: 0.8,
                                        fontWeight: 750,
                                      }}
                                    >
                                      <span>Bye {bye}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
