// src/ui.ts
export const ui = {
  colors: {
    pageBg: "#f5f6f8",
    cardBg: "#ffffff",
    border: "#e5e7eb",
    borderStrong: "#d1d5db",
    text: "#111827",
    muted: "#6b7280",
    subtleText: "#374151",
    inputBg: "#ffffff",
    focus: "rgba(37, 99, 235, 0.35)",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    secondaryBg: "#f3f4f6",
    secondaryHover: "#e5e7eb",
    danger: "#b91c1c",
    dangerBg: "#fee2e2",
  },

  radius: {
    sm: 8,
    md: 12,
  },

  shadow: {
    card: "0 1px 2px rgba(0,0,0,0.06)",
    popover: "0 10px 30px rgba(0,0,0,0.12)",
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
  },

  font: {
    h1: 22,
    h2: 16,
    body: 14,
    small: 12,
  },

  button: {
    base: {
      height: 34,
      padding: "0 12px",
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      userSelect: "none" as const,
      border: "1px solid transparent",
      background: "transparent",
      color: "#111827",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      lineHeight: 1,
      whiteSpace: "nowrap" as const,
    },

    primary: {
      background: "#2563eb",
      border: "1px solid #2563eb",
      color: "#ffffff",
    },

    secondary: {
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      color: "#111827",
    },

    ghost: {
      background: "transparent",
      border: "1px solid #e5e7eb",
      color: "#111827",
    },

    subtle: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      color: "#111827",
    },

    danger: {
      background: "#fee2e2",
      border: "1px solid #fecaca",
      color: "#991b1b",
    },
  },

  input: {
    base: {
      height: 34,
      padding: "0 10px",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      outline: "none",
      background: "#ffffff",
      color: "#111827",
      fontSize: 13,
      boxSizing: "border-box" as const,
    },
  },

  card: {
    base: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    },
  },
};
