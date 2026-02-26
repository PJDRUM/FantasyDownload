import { useRef } from "react";
import type { Player } from "../models/Player";
import type { RankingsListsState, TiersByPos } from "../utils/xlsxRankings";
import { exportRankingsXlsx, importRankingsXlsx, importRankingsCsv } from "../utils/xlsxRankings";

export function useRankingsIO(args: {
  rankingIdsByList: RankingsListsState<string[]>;
  playersById: Record<string, Player>;
  tiersByPosByList: RankingsListsState<TiersByPos>;

  basePlayers: Player[];

  setRankingIdsByList: React.Dispatch<React.SetStateAction<RankingsListsState<string[]>>>;
  setTiersByPosByList: React.Dispatch<React.SetStateAction<RankingsListsState<TiersByPos>>>;
  setExtraPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
}) {
  const { rankingIdsByList, playersById, tiersByPosByList, basePlayers, setRankingIdsByList, setTiersByPosByList, setExtraPlayers } =
    args;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function extLower(name: string) {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  }

  function exportRankingsXlsxClick() {
    const arrayBuffer = exportRankingsXlsx({
      rankingIdsByList,
      playersById,
      tiersByPosByList,
    });

    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Rankings.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importRankingsXlsxClick() {
    fileInputRef.current?.click();
  }

  function importRankingsXlsxFile(file: File) {
    const ext = extLower(file.name);
    const mime = (file.type || "").toLowerCase();
    const isCsv = ext === "csv" || mime === "text/csv";

    if (isCsv) {
      file
        .text()
        .then((csvText) => {
          const parsedRankings = importRankingsCsv({ csvText, sortBy: "rank" });
          const parsedKTC = importRankingsCsv({ csvText, sortBy: "sfvalue" });

          setRankingIdsByList((prev) =>
            ({
              ...prev,
              Rankings: parsedRankings.rankingIds,
              ...(parsedKTC.hasAnySfValue ? { KTC: parsedKTC.rankingIds } : {}),
            } as RankingsListsState<string[]>)
          );

          setTiersByPosByList((prev) =>
            ({
              ...prev,
              Rankings: parsedRankings.tiersByPos,
              ...(parsedKTC.hasAnySfValue ? { KTC: parsedKTC.tiersByPos } : {}),
            } as RankingsListsState<TiersByPos>)
          );

          const baseById = new Map(basePlayers.map((p) => [p.id, p]));

          setExtraPlayers((prev) => {
            const prevById = new Map(prev.map((p) => [p.id, p]));

            for (const imp of [...parsedRankings.players, ...parsedKTC.players]) {
              const base = baseById.get(imp.id);
              if (base) {
                const merged = { ...base, ...imp, imageUrl: imp.imageUrl || base.imageUrl };
                prevById.set(imp.id, merged);
              } else {
                const existing = prevById.get(imp.id);
                prevById.set(imp.id, existing ? { ...existing, ...imp } : imp);
              }
            }

            return Array.from(prevById.values());
          });

          alert("Imported rankings + tiers from CSV.");
        })
        .catch((err: any) => {
          alert(`Could not import CSV: ${err?.message ?? String(err)}`);
        });

      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const parsed = importRankingsXlsx({ xlsxArrayBuffer: buf });

        setRankingIdsByList((prev) => ({ ...prev, ...parsed.rankingIdsByList } as RankingsListsState<string[]>));
        setTiersByPosByList((prev) => ({ ...prev, ...parsed.tiersByPosByList } as RankingsListsState<TiersByPos>));

        const baseById = new Map(basePlayers.map((p) => [p.id, p]));

        setExtraPlayers((prev) => {
          const prevById = new Map(prev.map((p) => [p.id, p]));

          for (const imp of parsed.players) {
            const base = baseById.get(imp.id);
            if (base) {
              const merged = { ...base, ...imp, imageUrl: imp.imageUrl || base.imageUrl };
              prevById.set(imp.id, merged);
            } else {
              const existing = prevById.get(imp.id);
              prevById.set(imp.id, existing ? { ...existing, ...imp } : imp);
            }
          }

          return Array.from(prevById.values());
        });

        alert("Imported rankings + tiers from XLSX (1 sheet).");
      } catch (err: any) {
        alert(`Could not import XLSX: ${err?.message ?? String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return {
    fileInputRef,
    exportRankingsXlsxClick,
    importRankingsXlsxClick,
    importRankingsXlsxFile,
  };
}
