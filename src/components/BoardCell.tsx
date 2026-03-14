// src/components/BoardCell.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function BoardCell({
  id,
  drafted,
  favorite = false,
  dimWhenDrafted = true,
  showDraftedBanner = false,
  onToggleDrafted,
  onClick,
  bg,
  children,
  sortable = true,
  clickable = true,
  marginRight = 4,
  width = 140,
  minWidth = 140,
  height,
  minHeight,
  aspectRatio,
  borderRadius = 16,
  padding = 8,
}: {
  id: string;
  drafted: boolean;
  favorite?: boolean;
  dimWhenDrafted?: boolean;
  showDraftedBanner?: boolean;
  onToggleDrafted: (id: string) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  bg: string;
  children: React.ReactNode;
  sortable?: boolean;
  clickable?: boolean;
  marginRight?: number;
  width?: number;
  minWidth?: number;
  height?: number;
  minHeight?: number;
  aspectRatio?: string | number;
  borderRadius?: number;
  padding?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: drafted && dimWhenDrafted ? 0.55 : 1,
    filter: drafted && dimWhenDrafted ? "grayscale(20%)" : undefined,
    cursor: sortable ? "grab" : clickable ? "pointer" : "default",
    touchAction: sortable ? "none" : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      {...(sortable ? attributes : {})}
      {...(sortable ? listeners : {})}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) return onClick(e);
        onToggleDrafted(id);
      }}
      style={{
        ...style,
        boxSizing: "border-box",
        width,
        minWidth,
        height,
        minHeight,
        aspectRatio,
        borderRadius,
        border: "1px solid rgba(255,255,255,0.10)",
        outline: "1px solid rgba(0,0,0,0.18)",
        background: bg,
        padding,
        marginRight,
        position: "relative",
        userSelect: "none",
        boxShadow: isDragging ? "0 12px 28px rgba(0,0,0,0.18)" : "0 10px 22px rgba(0,0,0,0.14)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          background: "rgba(0,0,0,0.14)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

            {favorite && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            right: showDraftedBanner && drafted ? 62 : 6,
            width: 18,
            height: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fbbf24",
            fontSize: 16,
            lineHeight: 1,
            zIndex: 2,
            pointerEvents: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          ★
        </div>
      )}

{showDraftedBanner && drafted && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.2,
            background: "rgba(0,0,0,0.68)",
            color: "#fff",
          }}
        >
          DRAFTED
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function CellContent({
  label,
  name,
  position,
  team,
  imageUrl,
  showDash = true,
  showImage = true,
  compact = false,
  clampNameLines,
  forceFullName = false,
}: {
  label: string;
  name: string;
  position: string;
  team?: string;
  imageUrl?: string;
  showDash?: boolean;
  showImage?: boolean;
  compact?: boolean;
  clampNameLines?: number;
  forceFullName?: boolean;
}) {
  const displayName = React.useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return name;
    const firstInitial = parts[0].slice(0, 1).toUpperCase();
    const rest = parts.slice(1).join(" ");
    return `${firstInitial}. ${rest}`.trim();
  }, [name]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 2 : 6,
        height: "100%",
      }}
    >
      <div style={{ fontWeight: compact ? 650 : 900, fontSize: compact ? 8 : 12, lineHeight: compact ? 1 : undefined, opacity: compact ? 0.72 : 0.82, letterSpacing: compact ? -0.1 : 0, textShadow: compact ? "none" : "0 1px 2px rgba(0,0,0,0.65)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: compact ? 6 : 8, minHeight: 0, flex: 1 }}>
        {showImage && (
          <img
            src={imageUrl || "/headshot-placeholder.svg"}
            alt={name}
            style={{
              width: compact ? 28 : 34,
              height: compact ? 28 : 34,
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
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 1 : 2, minWidth: 0, minHeight: 0, flex: 1 }}>
          {compact && (position.trim() || team?.trim()) ? (
            <div
              style={{
                fontWeight: 600,
                fontSize: 7,
                lineHeight: 1,
                opacity: 0.72,
                letterSpacing: -0.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: compact ? "none" : "0 1px 2px rgba(0,0,0,0.65)",
              }}
            >
              {position.trim()}
              {team?.trim() ? ` - ${team.trim()}` : ""}
            </div>
          ) : null}
          <div
            style={{
              fontWeight: compact ? 700 : 900,
              fontSize: compact ? 7 : 14,
              lineHeight: compact ? 1.08 : 1.1,
              whiteSpace: compact ? "normal" : "nowrap",
              overflow: compact ? "hidden" : "hidden",
              textOverflow: compact ? "clip" : "ellipsis",
              wordBreak: compact ? "break-word" : "normal",
              display: compact && clampNameLines ? "-webkit-box" : undefined,
              WebkitBoxOrient: compact && clampNameLines ? "vertical" : undefined,
              WebkitLineClamp: compact && clampNameLines ? clampNameLines : undefined,
              textShadow: compact ? "none" : "0 1px 2px rgba(0,0,0,0.65)",
            }}
          >
            {compact && forceFullName ? name : compact ? name : displayName}
          </div>
          {!compact ? (
            <div style={{ fontWeight: 800, fontSize: compact ? 11 : 12, opacity: 0.85, textShadow: compact ? "none" : "0 1px 2px rgba(0,0,0,0.65)" }}>
              {position}{showDash ? " —" : ""}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
