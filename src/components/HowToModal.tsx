// ---------- Quick How-To modal ----------
import React from "react";

export default function HowToModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          background: "var(--bg-1)",
          color: "var(--text-0)",
          borderRadius: 12,
          border: "1px solid var(--border-1)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          padding: 16,
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Quick How-To</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border-1)",
              background: "transparent",
              color: "var(--text-0)",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.45 }}>
          <div style={{ marginBottom: 8 }}>
            Zoom out until you can see the entire board.
          </div>
          <div style={{ marginBottom: 8 }}>
            Export your rankings, then import them later to pick up where you left
            off (via the top-right menu).
          </div>
          <div style={{ marginBottom: 8 }}>
            Switching tabs in the Rankings List updates the board view to match the
            selected list.
          </div>
          <div style={{ marginBottom: 8 }}>
            Adjust rankings by dragging and dropping players on the Rankings Board.
          </div>
          <div style={{ marginBottom: 8 }}>
            Add or adjust tiers on the Cheatsheet.
          </div>
          <div style={{ marginBottom: 8 }}>
            Download the Cheatsheet PDF from the top-right menu.
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid var(--border-0)",
            }}
          >
            <span style={{ fontWeight: 900 }}>Tip:</span> If a player isn&apos;t on
            the Rankings Board, add more rounds until you can move them up.
          </div>
        </div>
      </div>
    </div>
  );
}
