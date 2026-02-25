import { useCallback, useEffect, useState } from "react";
import espnIdsJson from "../data/espnIds.json";
import { normalizeName, parseEspnIdsCsv } from "../utils/espn";

type EspnIdMap = Record<string, string>;

function asStringMap(v: unknown): EspnIdMap {
  if (!v || typeof v !== "object") return {};
  return v as EspnIdMap;
}

export function useEspnIds() {
  // Local snapshot (bundled) gives immediate headshots even if network fails.
  const [espnIdByNormName, setEspnIdByNormName] = useState<EspnIdMap>(() =>
    asStringMap(espnIdsJson)
  );

  // Allow manual merges (e.g., user-imported CSV)
  const mergeEspnIds = useCallback((next: EspnIdMap) => {
    setEspnIdByNormName((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEspnIds() {
      try {
        const url =
          "https://raw.githubusercontent.com/mayscopeland/ffb_ids/main/player_ids.csv";

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const rows = parseEspnIdsCsv(text);
        if (!rows.length) return;

        const header = (rows[0] ?? []).map((h) =>
          String(h ?? "").trim().toLowerCase()
        );

        const idxName = header.findIndex((h) =>
          ["espn_name", "full_name", "player_name", "name"].includes(h)
        );
        const idxEspn = header.findIndex((h) =>
          ["espn_id", "espn", "espnid", "espn_player_id"].includes(h)
        );

        if (idxName < 0 || idxEspn < 0) return;

        const map: EspnIdMap = {};

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] ?? [];
          const name = normalizeName(String(r[idxName] ?? ""));
          const espnId = String(r[idxEspn] ?? "").trim();
          if (!name || !espnId) continue;
          if (!map[name]) map[name] = espnId;
        }

        if (!cancelled && Object.keys(map).length) {
          // Remote overwrites local when present (more up-to-date)
          setEspnIdByNormName((prev) => ({ ...prev, ...map }));
        }
      } catch {
        // ignore (local snapshot still works)
      }
    }

    loadEspnIds();

    return () => {
      cancelled = true;
    };
  }, []);

  return { espnIdByNormName, mergeEspnIds };
}
