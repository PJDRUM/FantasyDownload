// src/components/Cheatsheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Position, Player } from "../models/Player";
import type { TiersByPos } from "../utils/xlsxRankings";

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

const POS_HEADER_IMG: Record<Position, string> = {
  QB: "/Quarterbacks.png",
  RB: "/RunningBacks.png",
  WR: "/WideReceivers.png",
  TE: "/TightEnds.png",
  K: "/Kicker.png",
  DST: "/Defense.png",
};

// Header viewport is fixed; tune each *image* independently below.
const HEADER_CONTAINER_HEIGHT_PX = 50;

// Per-position HEADER IMAGE sizing/tuning (does NOT change header container height).
// - imgTopPx: absolute top position of the image inside the viewport.
// - imgHeightPct: image element height as a percent of the viewport height (overscan to avoid gaps when shifting).
// - translateYPx: fine-tune vertical shift. + moves DOWN, - moves UP.
// - scale: fine-tune overall image scale (1 = normal).
const POS_HEADER_IMG_STYLE: Record<
  Position,
  {
    imgTopPx: number;
    imgHeightPct: number;
    translateYPx: number;
    scale: number;
  }
> = {
  QB: { imgTopPx: 0, imgHeightPct: 120, translateYPx: 0, scale: 1.02 }, // Quarterback Header Image Size
  RB: { imgTopPx: 3, imgHeightPct: 120, translateYPx: 0, scale: 1.1 }, // Running Back Header Image Size
  WR: { imgTopPx: 3, imgHeightPct: 120, translateYPx: 0, scale: 1.17 }, // Wide Receiver Header Image Size
  TE: { imgTopPx: 3, imgHeightPct: 120, translateYPx: 0, scale: 1.1 }, // Tight End Header Image Size
  K: { imgTopPx: 3, imgHeightPct: 120, translateYPx: 0, scale: 1 }, // Kicker Header Image Size
  DST: { imgTopPx: 3, imgHeightPct: 120, translateYPx: 0, scale: 1 }, // Defense Header Image Size
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

  posColor: (pos: Position) => string;
}) {
  const { favoriteIds, rankingIds, rankingsRankingIds, playersById, tiersByPos, onUpdateTiersByPos, draftedIds, onToggleDrafted, posColor } = props;

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
    <div style={{ boxSizing: "border-box", width: "fit-content", maxWidth: "100%", paddingTop: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${positions.length}, 280px)`,
          gap: 10,
          alignItems: "start",
        }}
      >
        {positions.map((pos) => {
          const headerImgStyle = POS_HEADER_IMG_STYLE[pos] ?? POS_HEADER_IMG_STYLE.QB;
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
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                outline: "1px solid rgba(0,0,0,0.18)",
                background: "var(--panel-bg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: HEADER_CONTAINER_HEIGHT_PX,
                  position: "relative",
                  background: "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <img
                  src={POS_HEADER_IMG[pos]}
                  alt={POS_LABEL[pos]}
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: headerImgStyle.imgTopPx,
                    width: "100%",
                    height: `${headerImgStyle.imgHeightPct}%`,
                    transform: `translateY(${headerImgStyle.translateYPx}px) scale(${headerImgStyle.scale})`,
                    objectFit: "cover",
                    objectPosition: "center",
                    userSelect: "none",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.50))",
                  }}
                />
              </div>

              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={addTier}
                    title="Add tier"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: "none",
                      background: tierColor,
                      color: "#ffffff",
                      fontWeight: 900,
                      lineHeight: "22px",
                      textAlign: "center",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={removeTier}
                    title="Remove tier"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: "none",
                      background: tierColor,
                      color: "#ffffff",
                      fontWeight: 900,
                      lineHeight: "22px",
                      textAlign: "center",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                    }}
                  >
                    −
                  </button>
                </div>

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
                          alignItems: "stretch",
                          justifyContent: "space-between",
                          padding: 0,
                          borderRadius: 10,
                          overflow: "hidden",
                          background: tierColor,
                          border: `1px solid ${tierColor}`,
                          fontWeight: 900,
                          fontSize: 12,
                          letterSpacing: 0.3,
                          color: "#ffffff",
                          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", padding: "6px 8px" }}>Tier {idx + 1}</span>

                        {!isTierOne && (
                          <span style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
                            <button
                              type="button"
                              aria-label="Move tier bar up"
                              title={canMoveUp ? "Move tier bar up" : "Need 2+ players in previous tier"}
                              disabled={!canMoveUp}
                              onClick={() => nudgeTierBar(pos, idx, "up")}
                              style={{
                                all: "unset",
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: canMoveUp ? "pointer" : "not-allowed",
                                opacity: canMoveUp ? 1 : 0.35,
                                background: "rgba(0,0,0,0.22)",
                                border: "1px solid rgba(255,255,255,0.20)",
                                lineHeight: 1,
                                fontSize: 10,
                                fontWeight: 900,
                                userSelect: "none",
                                boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
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
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: canMoveDown ? "pointer" : "not-allowed",
                                opacity: canMoveDown ? 1 : 0.35,
                                background: "rgba(0,0,0,0.22)",
                                border: "1px solid rgba(255,255,255,0.20)",
                                lineHeight: 1,
                                fontSize: 10,
                                fontWeight: 900,
                                userSelect: "none",
                                boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
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
                              border: "1px dashed rgba(255,255,255,0.18)",
                              color: "rgba(255,255,255,0.65)",
                              fontSize: 12,
                              fontWeight: 650,
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
                                onClick={() => onToggleDrafted(id)}
                                title={drafted ? "Undraft player" : "Draft player"}
                                style={{
                                  all: "unset",
                                  display: "grid",
                                  gridTemplateColumns: "46px 1fr",
                                  gap: 8,
                                  alignItems: "center",
                                  padding: "4px 2px",
                                  cursor: "pointer",
                                  opacity: drafted ? 0.35 : 1,
                                  textDecoration: drafted ? "line-through" : "none",
                                  borderBottom: "1px dashed rgba(255,255,255,0.06)",
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
  );
}
