import { useState } from "react";
import type { Player, Position } from "../models/Player";

export function useAddPlayer(args: {
  allPlayers: Player[];
  setExtraPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setRankingIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { allPlayers, setExtraPlayers, setRankingIds } = args;

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPos, setNewPlayerPos] = useState<Position>("WR");

  function slugify(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;

    const taken = new Set(allPlayers.map((p) => p.id));
    const base = slugify(name);

    let id = base;
    let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;

    const p: Player = {
      id,
      name,
      position: newPlayerPos,
    };

    setExtraPlayers((prev) => [...prev, p]);
    setRankingIds((prev) => [...prev, id]);
    setNewPlayerName("");
  }

  return {
    newPlayerName,
    setNewPlayerName,
    newPlayerPos,
    setNewPlayerPos,
    addPlayer,
  };
}
