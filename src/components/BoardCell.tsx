// src/components/BoardCell.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatTeamAbbreviation } from "../utils/teamAbbreviation";
import TeamLogo from "./TeamLogo";

function splitLabelAndArrow(label: string) {
  const trimmed = label.trim();
  if (trimmed.startsWith("← ")) {
    return { labelText: trimmed.slice(2).trim(), directionArrow: "←" };
  }
  if (trimmed.endsWith(" →")) {
    return { labelText: trimmed.slice(0, -2).trim(), directionArrow: "→" };
  }
  return { labelText: trimmed, directionArrow: "" };
}

function getNameLines(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] ?? "", ""];

  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
  const lastPart = parts[parts.length - 1] ?? "";
  if (parts.length >= 3 && suffixes.has(lastPart.toLowerCase())) {
    return [parts.slice(0, -2).join(" "), parts.slice(-2).join(" ")];
  }

  return [parts.slice(0, -1).join(" "), lastPart];
}

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
          top: 6,
          right: 0,
          bottom: 6,
          left: 0,
          borderRadius: Math.max(borderRadius - 4, 7),
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
          borderRadius: Math.max(borderRadius - 4, 7),
          background: "rgba(0,0,0,0.1)",
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
  const displayTeam = React.useMemo(() => formatTeamAbbreviation(team, "FA"), [team]);
  const { labelText, directionArrow } = React.useMemo(() => splitLabelAndArrow(label), [label]);
  const nameLines = React.useMemo(
    () => getNameLines(compact ? (forceFullName ? name : displayName) : name),
    [compact, displayName, forceFullName, name]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 2 : 6,
        height: "100%",
      }}
    >
      {compact ? (
        <>
          <div style={{ fontWeight: 650, fontSize: 8, lineHeight: 1, opacity: 0.72, letterSpacing: -0.1, textShadow: "none" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, minHeight: 0, flex: 1 }}>
            {showImage && (
              <img
                src={imageUrl || "/headshot-placeholder.svg"}
                alt={name}
                style={{
                  width: 28,
                  height: 28,
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
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, minHeight: 0, flex: 1 }}>
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
                    textShadow: "none",
                  }}
                >
                  <span>{position.trim()}</span>
                  {team?.trim() ? (
                    <>
                      <span style={{ opacity: 0.5 }}> - </span>
                      <TeamLogo
                        team={team.trim()}
                        size={8}
                        fallback={<span>{formatTeamAbbreviation(team.trim())}</span>}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 7,
                  lineHeight: 1.08,
                  whiteSpace: "normal",
                  overflow: "hidden",
                  textOverflow: "clip",
                  wordBreak: "break-word",
                  display: clampNameLines ? "-webkit-box" : undefined,
                  WebkitBoxOrient: clampNameLines ? "vertical" : undefined,
                  WebkitLineClamp: clampNameLines,
                  textShadow: "none",
                }}
              >
                {forceFullName ? name : name}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ position: "relative", height: "100%", minHeight: 72 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 2,
              fontSize: 13,
              lineHeight: 1,
              fontWeight: 700,
              color: "rgba(255,255,255,0.84)",
              letterSpacing: -0.1,
              textAlign: "right",
            }}
          >
            {labelText}
          </div>
          {directionArrow ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 1,
                fontSize: 16,
                lineHeight: 1,
                fontWeight: 500,
                color: "rgba(255,255,255,0.84)",
                letterSpacing: -0.1,
              }}
            >
              {directionArrow}
            </div>
          ) : null}
          {team?.trim() ? (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: -2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TeamLogo
                team={team.trim()}
                size={40}
                fallback={<span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{displayTeam}</span>}
              />
            </div>
          ) : null}
          {name === "—" ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 700,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              —
            </div>
          ) : (
            <>
              <div
                style={{
                  marginTop: 9,
                  paddingRight: directionArrow ? 28 : 24,
                  fontSize: 13,
                  lineHeight: 1,
                  fontWeight: 650,
                  color: "rgba(255,255,255,0.76)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: -0.1,
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                }}
              >
                <span>{position.trim()}</span>
                {showDash ? <span style={{ opacity: 0.5 }}>-</span> : null}
                {showDash ? <span>{displayTeam}</span> : null}
              </div>
              <div
                style={{
                  marginTop: 3,
                  paddingRight: directionArrow ? 22 : 16,
                  fontSize: 16,
                  lineHeight: 1.02,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.97)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  gap: 0,
                  minHeight: 24,
                  overflow: "hidden",
                  letterSpacing: -0.08,
                }}
              >
                <span
                  style={{
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nameLines[0]}
                </span>
                <span
                  style={{
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nameLines[1]}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
