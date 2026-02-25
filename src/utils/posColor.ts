// src/utils/posColor.ts
import type { Position } from "../models/Player";

export function posColor(pos: Position) {
  switch (pos) {
    case "QB":
      return "#b91c1c"; // further muted red
    case "RB":
      return "#16a34a";
    case "WR":
      return "#2563eb";
    case "TE":
      return "#d97706";
    case "K":
      return "#9090c8"; // purple (kicker)
    case "DST":
      return "#906050"; // brown (defense)
    default:
      return "#64748b";
  }
}
