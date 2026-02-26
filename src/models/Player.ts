// src/models/Player.ts
export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type Player = {
  id: string;
  name: string;
  position: Position;
  team?: string;
  imageUrl?: string;

  /** Optional external profile link for the player. */
  playerUrl?: string;
  /** Back-compat alias (older builds). Prefer playerUrl. */
  profileUrl?: string;

  /** Average Draft Position (optional; provided via import/export). */
  adp?: number;

  /** Player age (optional; provided via import/export). */
  age?: number;

  /** KTC 1QB value (optional; provided via import). */
  value?: number;

  /** KTC Superflex value (optional; provided via import). */
  sfValue?: number;

  /**
   * Optional metrics that may be provided via import (e.g., XLSX template).
   * Convention: 1–10 (decimals allowed). Import/export is lenient and will also accept 0–100 or 0–1 and normalize.
   */
  risk?: number;
  upside?: number;
};
