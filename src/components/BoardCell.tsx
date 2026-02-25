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
  marginRight = 4,
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
  marginRight?: number;
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
    cursor: sortable ? "grab" : "pointer",
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
        width: 140,
        minWidth: 140,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        outline: "1px solid rgba(0,0,0,0.18)",
        background: bg,
        padding: 8,
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
          borderRadius: 16,
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
  imageUrl,
  showDash = true,
}: {
  label: string;
  name: string;
  position: string;
  imageUrl?: string;
  showDash?: boolean;
}) {
  const displayName = React.useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return name;
    const firstInitial = parts[0].slice(0, 1).toUpperCase();
    const rest = parts.slice(1).join(" ");
    return `${firstInitial}. ${rest}`.trim();
  }, [name]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85, textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(
          <img
            src={imageUrl || "/headshot-placeholder.svg"}
            alt={name}
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
        )}
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
          >
            {displayName}
          </div>
          <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.85, textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}>
            {position}{showDash ? " —" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}