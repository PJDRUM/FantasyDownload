import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Position } from "../../models/Player";
import { posColor } from "../../utils/posColor";

export type TierScope = Position | "OVERALL";

function withAlpha(color: string, alpha: number) {
  const c = color.trim();

  // #RRGGBB
  if (/^#[0-9a-fA-F]{6}$/.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // rgb(r, g, b)
  const rgb = c.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

  // rgba(...) already, or unknown format → return as-is
  return c;
}

function scopeAccent(scope: TierScope) {
  return scope === "OVERALL" ? "rgb(34, 197, 94)" : posColor(scope);
}

/**
 * Overlay label shown at the top edge of the first player row in a tier.
 * Must not affect layout/spacing.
 */
export function TierOverlay(props: { label: string; accentColor?: string }) {
  const { label, accentColor } = props;

  const accent = accentColor ?? "rgb(34, 197, 94)";

  // NOTE: Sticky header has zIndex 30, so keep tier overlay below that.
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 22,
        userSelect: "none",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {/* the accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 4,
            background: withAlpha(accent, 0.92),
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        />
        {/* the center badge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translate(-50%, -0%)",
            padding: "3px 18px",
            borderRadius: 6,
            background: accent,
            color: "#fff",
            fontWeight: 900,
            fontSize: "clamp(7px, 1.5vw, 9px)",
            letterSpacing: 0.9,
            textTransform: "uppercase",
            lineHeight: 1,
            clipPath: "polygon(0 0, 100% 0, calc(100% - 18px) 100%, 18px 100%)",
            boxShadow: "0 10px 18px rgba(0,0,0,0.35)",
            zIndex: 3,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Draggable tier break handle + visual bar.
 *
 * The draggable id format is: "tier:<scope>:<startId>"
 * (scope is a Position like "QB" or "OVERALL")
 */
export function DraggableTierBar(props: {
  scope: TierScope;
  startId: string;
  topPx: number;
  isGhost?: boolean;
}) {
  const { scope, startId, topPx, isGhost } = props;

  const dragId = `tier:${scope}:${startId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  // Only the handle is interactive; the bar itself should not block row pointer events.
  const handleStyle: React.CSSProperties = {
    position: "absolute",
    right: 6,
    top: topPx - 12,
    width: 22,
    height: 22,
    borderRadius: 999,
    background: isDragging ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)",
    border: "1px solid rgba(0,0,0,0.35)",
    boxShadow: isDragging ? "0 10px 18px rgba(0,0,0,0.45)" : "0 6px 14px rgba(0,0,0,0.35)",
    cursor: "grab",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 25,
    touchAction: "none",
    userSelect: "none",
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <>
      <TierBar scope={scope} startId={startId} topPx={topPx} isGhost={isGhost} />
      <div ref={setNodeRef} style={handleStyle} {...attributes} {...listeners} title="Drag tier break">
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "rgba(0,0,0,0.35)",
            boxShadow: "inset 0 1px 2px rgba(255,255,255,0.25)",
          }}
        />
      </div>
    </>
  );
}

export default function TierBar({
  scope,
  startId,
  topPx,
  isGhost,
}: {
  scope: TierScope;
  startId: string;
  topPx: number;
  isGhost?: boolean;
}) {
  const accent = scopeAccent(scope);

  // startId is kept for stable keys/debugging even though dragging is disabled.
  return (
    <div
      aria-hidden="true"
      data-scope={scope}
      data-startid={startId}
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: topPx - 3,
        height: 6,
        borderRadius: 999,
        background: isGhost ? "rgba(255,255,255,0.35)" : withAlpha(accent, 0.22),
        border: isGhost ? "1px dashed rgba(255,255,255,0.55)" : `1px solid ${withAlpha(accent, 0.28)}`,
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
