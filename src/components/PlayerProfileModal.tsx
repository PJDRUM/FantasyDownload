import React, { useEffect, useMemo, useState } from "react";
import type { Player } from "../models/Player";
import type { PlayerProfileEntry } from "../data/playerProfiles";

type Props = {
  open?: boolean; // if omitted, default to true (back-compat)
  onClose: () => void;
  player: Player | null;
  links: PlayerProfileEntry[];
};

function normalizePodcastKey(podcast: string): string {
  return podcast.trim();
}

function toSlugVariants(name: string): string[] {
  const trimmed = name.trim();
  const noQuotes = trimmed.replace(/^["']+|["']+$/g, "");
  const collapsed = noQuotes.replace(/\s+/g, " ");
  const noSpace = collapsed.replace(/\s+/g, "");
  const underscores = collapsed.replace(/\s+/g, "_");
  const dashes = collapsed.replace(/\s+/g, "-");
  const alnumOnly = collapsed.replace(/[^a-zA-Z0-9]/g, "");
  return Array.from(new Set([collapsed, noSpace, underscores, dashes, alnumOnly].filter(Boolean)));
}

function buildLogoCandidates(podcastName: string): string[] {
  const folders = ["/Podcasts", "/podcasts"];
  const exts = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
  const bases = toSlugVariants(podcastName);

  const candidates: string[] = [];
  for (const folder of folders) {
    for (const base of bases) {
      for (const ext of exts) {
        candidates.push(`${folder}/${base}${ext}`);
      }
    }
  }
  return candidates;
}

function PodcastLogo({ podcast }: { podcast: string }) {
  const candidates = useMemo(() => buildLogoCandidates(podcast), [podcast]);
  const [idx, setIdx] = useState(0);

  const src = candidates[idx];

  if (!src) return null;

  return (
    <img
      src={src}
      alt={`${podcast} logo`}
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        objectFit: "cover",
        flex: "0 0 auto",
        background: "rgba(255,255,255,0.08)",
      }}
      onError={() => setIdx((v) => v + 1)}
    />
  );
}

export default function PlayerProfileModal({ open, onClose, player, links }: Props) {
  const isOpen = open ?? true;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlayerProfileEntry[]>();
    for (const link of links ?? []) {
      const key = normalizePodcastKey(link.podcast);
      const arr = map.get(key) ?? [];
      arr.push(link);
      map.set(key, arr);
    }
    // stable-ish sorting: podcast alpha, then label alpha
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, arr] of entries) {
      arr.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }
    return entries;
  }, [links]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          background: "rgba(10, 16, 28, 0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 18,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              {player?.name ?? "Player"}
            </div>
            <div style={{ opacity: 0.75, fontSize: 13, marginTop: 2 }}>
              {player ? `${player.position ?? ""}${player.team ? ` · ${player.team}` : ""}` : ""}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              borderRadius: 12,
              padding: "8px 14px",
              fontWeight: 600,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {(!player || (links?.length ?? 0) === 0) ? (
            <div style={{ opacity: 0.8, fontSize: 14 }}>
              No imported profile links yet{player?.id ? ` for ${player.id}.` : "."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {grouped.map(([podcast, items]) => (
                <div
                  key={podcast}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16,
                    padding: 14,
                    background: "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <PodcastLogo podcast={podcast} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {podcast}
                      </div>
                      <div style={{ opacity: 0.65, fontSize: 12, marginTop: 2 }}>
                        {items.length} link{items.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                    {items.map((it, i) => (
                      <a
                        key={`${it.podcast}-${it.label}-${i}`}
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          textDecoration: "none",
                          color: "white",
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: "rgba(255,255,255,0.06)",
                          padding: "8px 10px",
                          borderRadius: 999,
                          fontWeight: 700,
                          fontSize: 13,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        title={it.url}
                      >
                        {it.label}
                        <span aria-hidden="true" style={{ opacity: 0.75 }}>↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
