// src/App.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { players as basePlayersArr, rankingIds as initialRankingIds } from "./data/rankings";
import rankingsCsvUrl from "./data/rankings.csv";
import adpCsvUrl from "./data/adp.csv";
import consensusCsvUrl from "./data/consensus.csv";
import type { Position, Player } from "./models/Player";

import RankingsList from "./components/RankingsList";
import Board, { type BoardTab, type DraftStyle } from "./components/Board";
import HowToModal from "./components/HowToModal";
import TopBanner from "./components/TopBanner";
import CompareRankingsView, { type CompareRankingsColumn } from "./components/CompareRankingsView";

import { posColor } from "./utils/posColor";
import { exportCheatsheetPdf } from "./utils/cheatsheetPdf";
import { usePlayers } from "./state/usePlayers";
import { parseSimpleCsv } from "./utils/csv";
import { KTC_LAST_UPDATED, ADP_LAST_UPDATED, CONSENSUS_LAST_UPDATED } from "./data/rankings";

import {
  emptyTiersByPos,
  exportRankingsXlsx,
  importRankingsXlsx,
  importRankingsCsv,
  RANKINGS_LIST_KEYS,
  type RankingsListKey,
  type TiersByPos,
} from "./utils/xlsxRankings";

import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

type ScoringFormat = "standard" | "halfPpr" | "ppr";
type AppView = "draftCompanion" | "compareRankings";
type ImportedCompareList = {
  id: string;
  title: string;
  rankingIds: string[];
};

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;

  const normalized = text.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function getAdpValueForFormat(player: Player, format: ScoringFormat): number | undefined {
  if (format === "standard") return player.adpStandard;
  if (format === "halfPpr") return player.adpHalfPpr;
  return player.adpPpr;
}

function getConsensusValueForFormat(player: Player, format: ScoringFormat): number | undefined {
  if (format === "standard") return player.consensusStandard;
  if (format === "halfPpr") return player.consensusHalfPpr;
  return player.consensusPpr;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("draftCompanion");
  const [teams, setTeams] = useState(12);
  const [teamNames, setTeamNames] = useState<string[]>(
    Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`)
  );

  useEffect(() => {
    setTeamNames((prev) => Array.from({ length: teams }, (_, i) => prev[i] ?? `Team ${i + 1}`));
  }, [teams]);

  const [draftStyle, setDraftStyle] = useState<DraftStyle>("Snake Draft");

  // ----- fixed rankings lists -----
  const [rankingsListKey, setRankingsListKey] = useState<RankingsListKey>("Rankings");

  const [ktcValueMode, setKtcValueMode] = useState<"1qb" | "2qb">("2qb");
  const [ktcRankingIdsByMode, setKtcRankingIdsByMode] = useState<{ "1qb": string[]; "2qb": string[] }>({ "1qb": [], "2qb": [] });

  const [adpFormat, setAdpFormat] = useState<ScoringFormat>(() => {
    if (typeof window === "undefined") return "halfPpr";
    const saved = window.localStorage.getItem("fantasy-board:adp-format");
    return saved === "standard" || saved === "halfPpr" || saved === "ppr" ? saved : "halfPpr";
  });
  const [adpRankingIdsByFormat, setAdpRankingIdsByFormat] = useState<Record<ScoringFormat, string[]>>({
    standard: [...initialRankingIds],
    halfPpr: [...initialRankingIds],
    ppr: [...initialRankingIds],
  });

  const [consensusFormat, setConsensusFormat] = useState<ScoringFormat>(() => {
    if (typeof window === "undefined") return "halfPpr";
    const saved = window.localStorage.getItem("fantasy-board:consensus-format");
    return saved === "standard" || saved === "halfPpr" || saved === "ppr" ? saved : "halfPpr";
  });
  const [compareConsensusFormat, setCompareConsensusFormat] = useState<ScoringFormat>("halfPpr");
  const [compareKtcValueMode, setCompareKtcValueMode] = useState<"1qb" | "2qb">("2qb");
  const [hideKickers, setHideKickers] = useState(false);
  const [hideDefenses, setHideDefenses] = useState(false);
  const [compareImportedLists, setCompareImportedLists] = useState<ImportedCompareList[]>([]);
  const [showCompareConsensus, setShowCompareConsensus] = useState(true);
  const [showCompareKtc, setShowCompareKtc] = useState(true);
  const [compareColumnOrder, setCompareColumnOrder] = useState<string[]>(["my-rankings", "consensus-rankings", "ktc-rankings"]);
  const [consensusRankingIdsByFormat, setConsensusRankingIdsByFormat] = useState<Record<ScoringFormat, string[]>>({
    standard: [...initialRankingIds],
    halfPpr: [...initialRankingIds],
    ppr: [...initialRankingIds],
  });

  const [rankingIdsByList, setRankingIdsByList] = useState<Record<RankingsListKey, string[]>>(() => ({
    Rankings: [...initialRankingIds],
    Consensus: [...initialRankingIds],
    KTC: [...initialRankingIds],
    ADP: [...initialRankingIds],
  }));

  const [tiersByPosByList, setTiersByPosByList] = useState<Record<RankingsListKey, TiersByPos>>(() => ({
    Rankings: emptyTiersByPos(),
    Consensus: emptyTiersByPos(),
    KTC: emptyTiersByPos(),
    ADP: emptyTiersByPos(),
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("fantasy-board:adp-format", adpFormat);
  }, [adpFormat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("fantasy-board:consensus-format", consensusFormat);
  }, [consensusFormat]);

  // Load KTC rankings from src/data/rankings.csv (supports 1QB "Value" + 2QB "SFValue")
  useEffect(() => {
    fetch(`${rankingsCsvUrl}?v=${encodeURIComponent(KTC_LAST_UPDATED)}`)
      .then((r) => r.text())
      .then((csvText) => {
        const parsed1qb = importRankingsCsv({ csvText, sortBy: "value" });
        const parsed2qb = importRankingsCsv({ csvText, sortBy: "sfvalue" });

        const players = (parsed2qb.players.length ? parsed2qb.players : parsed1qb.players) ?? [];
        setKtcPlayers(players);

        const ids1 = parsed1qb.rankingIds ?? [];
        const ids2 = parsed2qb.rankingIds ?? [];
        setKtcRankingIdsByMode({ "1qb": ids1, "2qb": ids2 });

        const chosen = ktcValueMode === "1qb" ? ids1 : ids2;
        if (chosen.length) {
          setRankingIdsByList((prev) => ({ ...prev, KTC: chosen }));
          setTiersByPosByList((prev) => ({ ...prev, KTC: emptyTiersByPos() }));
        }
      })
      .catch(() => {
        // ignore
      });
  }, [ktcValueMode]);

  // Load ADP rankings from src/data/adp.csv (Standard / Half-PPR / PPR).
  useEffect(() => {
    fetch(`${adpCsvUrl}?v=${encodeURIComponent(ADP_LAST_UPDATED)}`)
      .then((r) => r.text())
      .then((csvText) => {
        const rows = parseSimpleCsv(csvText);
        if (!rows.length) return;

        const header = (rows[0] ?? []).map((cell) => String(cell ?? "").trim().toLowerCase());

        const idxId = header.findIndex((cell) => cell === "id");
        const idxName = header.findIndex((cell) => cell === "name");
        const idxPosition = header.findIndex((cell) => cell === "position" || cell === "pos");
        const idxTeam = header.findIndex((cell) => cell === "team");
        const idxStandard = header.findIndex((cell) => cell === "adpstandard");
        const idxHalfPpr = header.findIndex((cell) => cell === "adphalfppr");
        const idxPpr = header.findIndex((cell) => cell === "adpppr");

        const players = rows.slice(1).reduce<Player[]>((acc, row) => {
          const id = String(row[idxId] ?? "").trim();
          if (!id) return acc;

          const name = String(row[idxName] ?? "").trim();
          const position = String(row[idxPosition] ?? "").trim().toUpperCase() as Position;
          const team = String(row[idxTeam] ?? "").trim();

          acc.push({
            id,
            name,
            position,
            team: team || undefined,
            adpStandard: parseOptionalNumber(row[idxStandard]),
            adpHalfPpr: parseOptionalNumber(row[idxHalfPpr]),
            adpPpr: parseOptionalNumber(row[idxPpr]),
          });

          return acc;
        }, []);

        const sortBy = (format: ScoringFormat) => {
          return [...players]
            .filter((player) => typeof getAdpValueForFormat(player, format) === "number")
            .sort((a, b) => {
              const aValue = getAdpValueForFormat(a, format) ?? Number.POSITIVE_INFINITY;
              const bValue = getAdpValueForFormat(b, format) ?? Number.POSITIVE_INFINITY;
              if (aValue !== bValue) return aValue - bValue;
              return a.name.localeCompare(b.name);
            })
            .map((player) => player.id);
        };

        const nextIdsByFormat = {
          standard: sortBy("standard"),
          halfPpr: sortBy("halfPpr"),
          ppr: sortBy("ppr"),
        };

        setAdpPlayers(players);
        setAdpRankingIdsByFormat(nextIdsByFormat);

        const chosen = nextIdsByFormat[adpFormat];
        if (chosen.length) {
          setRankingIdsByList((prev) => ({ ...prev, ADP: chosen }));
          setTiersByPosByList((prev) => ({ ...prev, ADP: emptyTiersByPos() }));
        }
      })
      .catch(() => {
        // ignore
      });
  }, [adpFormat]);

  // Load consensus rankings from src/data/consensus.csv (Standard / Half-PPR / PPR).
  useEffect(() => {
    fetch(`${consensusCsvUrl}?v=${encodeURIComponent(CONSENSUS_LAST_UPDATED)}`)
      .then((r) => r.text())
      .then((csvText) => {
        const rows = parseSimpleCsv(csvText);
        if (!rows.length) return;

        const header = (rows[0] ?? []).map((cell) => String(cell ?? "").trim().toLowerCase());

        const idxId = header.findIndex((cell) => cell === "id");
        const idxName = header.findIndex((cell) => cell === "name");
        const idxPosition = header.findIndex((cell) => cell === "position" || cell === "pos");
        const idxTeam = header.findIndex((cell) => cell === "team");
        const idxStandard = header.findIndex((cell) => cell === "consensusstandard");
        const idxHalfPpr = header.findIndex((cell) => cell === "consensushalfppr");
        const idxPpr = header.findIndex((cell) => cell === "consensusppr");

        const players = rows.slice(1).reduce<Player[]>((acc, row) => {
          const id = String(row[idxId] ?? "").trim();
          if (!id) return acc;

          const name = String(row[idxName] ?? "").trim();
          const position = String(row[idxPosition] ?? "").trim().toUpperCase() as Position;
          const team = String(row[idxTeam] ?? "").trim();

          acc.push({
            id,
            name,
            position,
            team: team || undefined,
            consensusStandard: parseOptionalNumber(row[idxStandard]),
            consensusHalfPpr: parseOptionalNumber(row[idxHalfPpr]),
            consensusPpr: parseOptionalNumber(row[idxPpr]),
          });

          return acc;
        }, []);

        const sortBy = (format: ScoringFormat) => {
          return [...players]
            .filter((player) => typeof getConsensusValueForFormat(player, format) === "number")
            .sort((a, b) => {
              const aValue = getConsensusValueForFormat(a, format) ?? Number.POSITIVE_INFINITY;
              const bValue = getConsensusValueForFormat(b, format) ?? Number.POSITIVE_INFINITY;
              if (aValue !== bValue) return aValue - bValue;
              return a.name.localeCompare(b.name);
            })
            .map((player) => player.id);
        };

        const nextIdsByFormat = {
          standard: sortBy("standard"),
          halfPpr: sortBy("halfPpr"),
          ppr: sortBy("ppr"),
        };

        setConsensusPlayers(players);
        setConsensusRankingIdsByFormat(nextIdsByFormat);

        const chosen = nextIdsByFormat[consensusFormat];
        if (chosen.length) {
          setRankingIdsByList((prev) => ({ ...prev, Consensus: chosen }));
          setTiersByPosByList((prev) => ({ ...prev, Consensus: emptyTiersByPos() }));
        }
      })
      .catch(() => {
        // ignore
      });
  }, [consensusFormat]);

  // Re-apply KTC ordering when switching between 1QB/2QB.
  useEffect(() => {
    const ids = ktcValueMode === "1qb" ? ktcRankingIdsByMode["1qb"] : ktcRankingIdsByMode["2qb"];
    if (ids && ids.length) {
      setRankingIdsByList((prev) => ({ ...prev, KTC: ids }));
    }
  }, [ktcValueMode, ktcRankingIdsByMode]);

  // Re-apply ADP ordering when switching between Standard / Half-PPR / PPR.
  useEffect(() => {
    const ids = adpRankingIdsByFormat[adpFormat];
    if (ids && ids.length) {
      setRankingIdsByList((prev) => ({ ...prev, ADP: ids }));
    }
  }, [adpFormat, adpRankingIdsByFormat]);

  useEffect(() => {
    const ids = consensusRankingIdsByFormat[consensusFormat];
    if (ids && ids.length) {
      setRankingIdsByList((prev) => ({ ...prev, Consensus: ids }));
    }
  }, [consensusFormat, consensusRankingIdsByFormat]);
  const rankingIds = rankingIdsByList[rankingsListKey];
  const tiersByPos = tiersByPosByList[rankingsListKey];

  function moveRankings(fromIndex: number, toIndex: number) {
    setRankingIdsByList((prev) => {
      const next = arrayMove(prev.Rankings, fromIndex, toIndex);
      return { ...prev, Rankings: next };
    });
  }

  // Board should reflect the active RankingsList tab (Rankings vs KTC)
  const boardTiersByPos = tiersByPosByList[rankingsListKey];

  const onUpdateTiersByPos = useCallback(
    (pos: Position, tierBreaks: string[]) => {
      setTiersByPosByList((prev) => ({
        ...prev,
        [rankingsListKey]: {
          ...prev[rankingsListKey],
          [pos]: tierBreaks,
        },
      }));
    },
    [rankingsListKey]
  );

  const onUpdateRankingsTiersByPos = useCallback(
    (pos: Position, tierBreaks: string[]) => {
      setTiersByPosByList((prev) => ({
        ...prev,
        Rankings: {
          ...prev.Rankings,
          [pos]: tierBreaks,
        },
      }));
    },
    []
  );

  // ----- drafted state -----
  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set());
  const [, setDraftedOrder] = useState<string[]>([]);

  // ----- favorite state -----
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  function toggleFavorite(id: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Rankings list position tab
  const [activeTab, setActiveTab] = useState<"Overall" | Position>("Overall");
  const [boardTab, setBoardTab] = useState<BoardTab>("Rankings Board");

  // ----- players (base + ADP overrides + KTC overrides + imported extras) -----
  const [adpPlayers, setAdpPlayers] = useState<Player[]>([]);
  const [consensusPlayers, setConsensusPlayers] = useState<Player[]>([]);
  const [ktcPlayers, setKtcPlayers] = useState<Player[]>([]);

  const basePlayers = useMemo(() => {
    const mergedById = new Map<string, Player>();

    for (const source of [basePlayersArr, adpPlayers, consensusPlayers, ktcPlayers]) {
      for (const player of source) {
        const existing = mergedById.get(player.id);
        mergedById.set(player.id, {
          ...existing,
          ...player,
        });
      }
    }

    return Array.from(mergedById.values());
  }, [adpPlayers, consensusPlayers, ktcPlayers]);

  const { extraPlayers, setExtraPlayers, allPlayersArr: allPlayers, playersById } = usePlayers({
    basePlayers,
  });
  const filteredKtcRankingIds = useMemo(() => {
    return rankingIdsByList.KTC.filter((id) => {
      const player = playersById[id];
      if (!player) return false;
      if (hideKickers && player.position === "K") return false;
      if (hideDefenses && player.position === "DST") return false;
      return true;
    });
  }, [rankingIdsByList, playersById, hideKickers, hideDefenses]);
  const filteredAdpRankingIds = useMemo(() => {
    return (adpRankingIdsByFormat[adpFormat] ?? []).filter((id) => {
      const player = playersById[id];
      if (!player) return false;
      if (hideKickers && player.position === "K") return false;
      if (hideDefenses && player.position === "DST") return false;
      return true;
    });
  }, [adpRankingIdsByFormat, adpFormat, playersById, hideKickers, hideDefenses]);
  const filteredConsensusRankingIds = useMemo(() => {
    return (consensusRankingIdsByFormat[consensusFormat] ?? []).filter((id) => {
      const player = playersById[id];
      if (!player) return false;
      if (hideKickers && player.position === "K") return false;
      if (hideDefenses && player.position === "DST") return false;
      return true;
    });
  }, [consensusRankingIdsByFormat, consensusFormat, playersById, hideKickers, hideDefenses]);
  const boardRankingIds = useMemo(() => {
    return rankingIdsByList[rankingsListKey].filter((id) => {
      const player = playersById[id];
      if (!player) return false;
      if (hideKickers && player.position === "K") return false;
      if (hideDefenses && player.position === "DST") return false;
      return true;
    });
  }, [rankingIdsByList, rankingsListKey, playersById, hideKickers, hideDefenses]);
  const setKtcAsRankings = useCallback(() => {
    if (!filteredKtcRankingIds.length) return;
    setRankingIdsByList((prev) => ({ ...prev, Rankings: [...filteredKtcRankingIds] }));
  }, [filteredKtcRankingIds]);
  const setAdpAsRankings = useCallback(() => {
    if (!filteredAdpRankingIds.length) return;
    setRankingIdsByList((prev) => ({ ...prev, Rankings: [...filteredAdpRankingIds] }));
  }, [filteredAdpRankingIds]);
  const setConsensusAsRankings = useCallback(() => {
    if (!filteredConsensusRankingIds.length) return;
    setRankingIdsByList((prev) => ({ ...prev, Rankings: [...filteredConsensusRankingIds] }));
  }, [filteredConsensusRankingIds]);
  const setActiveSourceAsRankings = rankingsListKey === "ADP"
    ? setAdpAsRankings
    : rankingsListKey === "Consensus"
      ? setConsensusAsRankings
      : rankingsListKey === "KTC"
        ? setKtcAsRankings
        : undefined;

  const addPlayerToRankings = useCallback(
    (name: string, position: Position) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const id = `custom-${uuid}`;

      const newPlayer: Player = {
        id,
        name: trimmed,
        position,
      };

      setExtraPlayers((prev) => [newPlayer, ...prev]);

      setRankingIdsByList((prev) => ({
        Rankings: [id, ...prev.Rankings.filter((x) => x !== id)],
        Consensus: [id, ...prev.Consensus.filter((x) => x !== id)],
        KTC: [id, ...prev.KTC.filter((x) => x !== id)],
        ADP: [id, ...prev.ADP.filter((x) => x !== id)],
      }));
      setAdpRankingIdsByFormat((prev) => ({
        standard: [id, ...prev.standard.filter((x) => x !== id)],
        halfPpr: [id, ...prev.halfPpr.filter((x) => x !== id)],
        ppr: [id, ...prev.ppr.filter((x) => x !== id)],
      }));
      setConsensusRankingIdsByFormat((prev) => ({
        standard: [id, ...prev.standard.filter((x) => x !== id)],
        halfPpr: [id, ...prev.halfPpr.filter((x) => x !== id)],
        ppr: [id, ...prev.ppr.filter((x) => x !== id)],
      }));
    },
    [setExtraPlayers, setRankingIdsByList]
  );

  // ----- draft slots -----
  const computedRounds = Math.ceil(rankingIds.length / teams);
  const prevComputedRoundsRef = useRef<number>(computedRounds);
  const [rounds, setRounds] = useState<number>(16);

  useEffect(() => {
    const prevComputed = prevComputedRoundsRef.current;
    prevComputedRoundsRef.current = computedRounds;

    setRounds((prev) => {
      const normalized = Number.isFinite(prev) ? Math.max(1, Math.min(40, Math.round(prev))) : computedRounds;

      // If the user never changed rounds (still matches computed), keep tracking computed.
      if (prev === prevComputed) return computedRounds;

      return normalized;
    });
  }, [computedRounds]);

  const totalDraftSlots = rounds * teams;

  const [draftSlots, setDraftSlots] = useState<(string | null)[]>(() => Array.from({ length: totalDraftSlots }, () => null));

  const assignPlayerToDraftSlot = useCallback((pickIndex: number, playerId: string) => {
    setDraftSlots((prev) => {
      const next = [...prev];
      next[pickIndex] = playerId;
      return next;
    });
  }, []);


  useEffect(() => {
    setDraftSlots((prev) => {
      const next = Array.from({ length: totalDraftSlots }, (_, i) => prev[i] ?? null);
      return next;
    });
  }, [totalDraftSlots]);

  // ----- How-To popup -----
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const key = "fantasy-board:howto:v1";
    const already = typeof window !== "undefined" ? localStorage.getItem(key) : "1";
    if (!already) setShowHowTo(true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHowTo(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  function closeHowTo() {
    try {
      localStorage.setItem("fantasy-board:howto:v1", "1");
    } catch {}
    setShowHowTo(false);
  }

  // ----- DnD sensors (draft board only; rankings board cells are non-sortable) -----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onBoardDragEnd(event: DragEndEvent) {
    // Only the editable Rankings list can be reordered. (KTC/ADP are static.)
    if (rankingsListKey !== "Rankings") return;
    // Rankings Board: allow re-ordering the active rankings list via drag & drop.
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const a = String(active.id);
    const b = String(over.id);

    const current = rankingIdsByList[rankingsListKey];
    const fromIndex = current.indexOf(a);
    const toIndex = current.indexOf(b);
    if (fromIndex < 0 || toIndex < 0) return;

    setRankingIdsByList((prev) => {
      const list = prev[rankingsListKey];
      // Defensive: ensure indices still valid for the latest state
      const fi = list.indexOf(a);
      const ti = list.indexOf(b);
      if (fi < 0 || ti < 0 || fi === ti) return prev;
      return { ...prev, [rankingsListKey]: arrayMove(list, fi, ti) };
    });
  }

  function onCompareColumnReorder(fromId: string, toId: string) {
    setCompareColumnOrder((prev) => {
      const fromIndex = prev.indexOf(fromId);
      const toIndex = prev.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return arrayMove(prev, fromIndex, toIndex);
    });
  }

  function onCompareMyRankingsMove(fromId: string, toId: string) {
    setRankingIdsByList((prev) => {
      const current = prev.Rankings;
      const fromIndex = current.indexOf(fromId);
      const toIndex = current.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return { ...prev, Rankings: arrayMove(current, fromIndex, toIndex) };
    });
  }

  function onRemoveCompareColumn(columnId: string) {
    if (columnId === "consensus-rankings") {
      setShowCompareConsensus(false);
    } else if (columnId === "ktc-rankings") {
      setShowCompareKtc(false);
    } else {
      setCompareImportedLists((prev) => prev.filter((list) => list.id !== columnId));
    }
    setCompareColumnOrder((prev) => prev.filter((id) => id !== columnId));
  }

  function onDraftBoardDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const a = String(active.id);
    const b = String(over.id);

    if (!a.startsWith("draftslot:") || !b.startsWith("draftslot:")) return;

    const from = Number(a.split(":")[1]);
    const to = Number(b.split(":")[1]);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;

    setDraftSlots((prev) => {
      const next = [...prev];
      const tmp = next[from] ?? null;
      next[from] = next[to] ?? null;
      next[to] = tmp;
      return next;
    });
  }

  function toggleDrafted(id: string) {
    setDraftedIds((prev) => {
      const next = new Set(prev);
      const wasDrafted = next.has(id);

      if (wasDrafted) next.delete(id);
      else next.add(id);

      setDraftedOrder((prevOrder) => {
        if (wasDrafted) return prevOrder.filter((x) => x !== id);
        if (prevOrder.includes(id)) return prevOrder;
        return [...prevOrder, id];
      });

      setDraftSlots((prevSlots) => {
        const slots = [...prevSlots];

        if (wasDrafted) {
          for (let i = 0; i < slots.length; i++) {
            if (slots[i] === id) slots[i] = null;
          }
          return slots;
        }

        if (slots.includes(id)) return slots;

        const firstEmpty = slots.findIndex((v) => v == null);
        if (firstEmpty >= 0) slots[firstEmpty] = id;

        return slots;
      });

      return next;
    });
  }

  function clearAllDrafted() {
    setDraftedIds(new Set());
    setDraftedOrder([]);
    setDraftSlots(Array.from({ length: totalDraftSlots }, () => null));
  }

  // ----- tiers normalization (still used for import safety) -----
  function normalizeTierBreaks(pos: Position, breaks: string[], ids: string[]) {
    const posIds = ids.filter((id) => playersById[id]?.position === pos);
    const posSet = new Set(posIds);

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of breaks) {
      if (!posSet.has(id)) continue;
      if (seen.has(id)) continue;
      if (posIds.indexOf(id) <= 0) continue;
      seen.add(id);
      unique.push(id);
    }

    unique.sort((a, b) => posIds.indexOf(a) - posIds.indexOf(b));
    return unique;
  }

  // ----- Import / Export (XLSX with 1 sheet: Rankings) -----
  const compareFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    a.download = "Rankings Export.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCheatsheetPdfClick() {
    exportCheatsheetPdf({
      rankingIds: rankingIdsByList[rankingsListKey] ?? [],
      playersById,
      tiersByPos: tiersByPosByList[rankingsListKey],
      posColor,
      filename: "Cheatsheet.pdf",
    });
  }

  function importRankingsXlsxClick() {
    fileInputRef.current?.click();
  }

  function importCompareRankingsClick() {
    compareFileInputRef.current?.click();
  }

  function mergeImportedPlayers(players: Player[]) {
    const baseById = new Map(basePlayers.map((p) => [p.id, p]));

    setExtraPlayers((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));

      for (const imp of players) {
        const base = baseById.get(imp.id);
        const { sfValue: _sfValue, ...impNoKtc } = imp as any;

        if (base) {
          const existing = prevById.get(imp.id);
          const merged = {
            ...base,
            ...(existing ?? {}),
            ...impNoKtc,
            imageUrl:
              (impNoKtc as any).imageUrl ||
              (existing as any)?.imageUrl ||
              (base as any).imageUrl ||
              "",
          };
          prevById.set(imp.id, merged);
          continue;
        }

        const existing = prevById.get(imp.id);
        prevById.set(imp.id, existing ? { ...existing, ...impNoKtc } : (impNoKtc as any));
      }

      return Array.from(prevById.values());
    });
  }

  function importRankingsXlsxFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const parsed = importRankingsXlsx({ xlsxArrayBuffer: buf });

        // Apply import ONLY to the user-editable Rankings tab (KTC is sourced from rankings.csv)
        if (parsed.rankingIdsByList.Rankings) {
          setRankingIdsByList((prev) => ({ ...prev, Rankings: parsed.rankingIdsByList.Rankings! }));
        }

        setTiersByPosByList((prev) => {
          const next = { ...prev };
          for (const k of ["Rankings"] as const) {
            const v = parsed.tiersByPosByList[k];
            if (v !== undefined) next[k] = v;
          }
          // Normalize against current playersById + ids in each sheet
          for (const k of ["Rankings"] as const) {
            const ids = (parsed.rankingIdsByList[k] ?? rankingIdsByList[k]) ?? [];
            next[k] = {
              QB: normalizeTierBreaks("QB", next[k].QB ?? [], ids),
              RB: normalizeTierBreaks("RB", next[k].RB ?? [], ids),
              WR: normalizeTierBreaks("WR", next[k].WR ?? [], ids),
              TE: normalizeTierBreaks("TE", next[k].TE ?? [], ids),
              K: normalizeTierBreaks("K", next[k].K ?? [], ids),
              DST: normalizeTierBreaks("DST", next[k].DST ?? [], ids),
            };
          }
          return next;
        });

        // extra players / overrides
        // NOTE: We store imported player rows into extraPlayers *even if the player exists in basePlayersArr*.
        // This allows imports to override optional fields like risk/upside/adp without mutating the bundled base data.
        mergeImportedPlayers(parsed.players);

        alert("Imported rankings + tiers from XLSX.");
      } catch (err: any) {
        alert(`Could not import XLSX: ${err?.message ?? String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function importCompareRankingsFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const parsed = importRankingsXlsx({ xlsxArrayBuffer: buf });
        const importedIds = parsed.rankingIdsByList.Rankings ?? [];
        if (!importedIds.length) {
          alert("No rankings found in that file.");
          return;
        }

        mergeImportedPlayers(parsed.players);

        const fileLabel = file.name.replace(/\.[^.]+$/, "").trim() || "Imported Rankings";
        const listId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? `imported-${(crypto as any).randomUUID()}`
            : `imported-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        setCompareImportedLists((prev) => [
          ...prev,
          {
            id: listId,
            title: fileLabel,
            rankingIds: importedIds,
          },
        ]);
        setCompareColumnOrder((prev) => [...prev, listId]);
        setActiveView("compareRankings");
      } catch (err: any) {
        alert(`Could not import comparison rankings: ${err?.message ?? String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const compareColumns = useMemo<CompareRankingsColumn[]>(() => {
    const baseColumns: CompareRankingsColumn[] = [
      {
        id: "my-rankings",
        title: "My Rankings",
        subtitle: "Editable list",
        rankingIds: rankingIdsByList.Rankings,
        accent: "#22c55e",
        editable: true,
      },
    ];

    if (showCompareConsensus) {
      baseColumns.push({
        id: "consensus-rankings",
        title: "Consensus Rankings",
        subtitle: "Fixed source",
        rankingIds: consensusRankingIdsByFormat[compareConsensusFormat] ?? [],
        accent: "#38bdf8",
        removable: true,
        controls: (
          <div
            role="group"
            aria-label="Consensus ranking format"
            style={{
              display: "inline-flex",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              overflow: "hidden",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {([
              { id: "standard", label: "Std" },
              { id: "halfPpr", label: "Half" },
              { id: "ppr", label: "PPR" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCompareConsensusFormat(option.id)}
                style={{
                  padding: "4px 8px",
                  border: "none",
                  background: compareConsensusFormat === option.id ? "rgba(255,255,255,0.16)" : "transparent",
                  color: "var(--text-0)",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ),
      });
    }

    if (showCompareKtc) {
      baseColumns.push({
        id: "ktc-rankings",
        title: "Dynasty Values",
        subtitle: "Fixed source",
        rankingIds: ktcRankingIdsByMode[compareKtcValueMode] ?? [],
        accent: "#a78bfa",
        removable: true,
        controls: (
          <div
            role="group"
            aria-label="Dynasty values format"
            style={{
              display: "inline-flex",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              overflow: "hidden",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {([
              { id: "1qb", label: "1QB" },
              { id: "2qb", label: "2QB" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCompareKtcValueMode(option.id)}
                style={{
                  padding: "4px 8px",
                  border: "none",
                  background: compareKtcValueMode === option.id ? "rgba(255,255,255,0.16)" : "transparent",
                  color: "var(--text-0)",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ),
      });
    }

    baseColumns.push(
      ...compareImportedLists.map((list, index) => ({
        id: list.id,
        title: list.title,
        subtitle: `Imported list ${index + 1}`,
        rankingIds: list.rankingIds,
        accent: "#f59e0b",
        removable: true,
      }))
    );

    const byId = new Map(baseColumns.map((column) => [column.id, column]));
    const ordered = compareColumnOrder.map((id) => byId.get(id)).filter((column): column is CompareRankingsColumn => Boolean(column));
    const unordered = baseColumns.filter((column) => !compareColumnOrder.includes(column.id));
    return [...ordered, ...unordered];
  }, [
    rankingIdsByList,
    consensusRankingIdsByFormat,
    compareConsensusFormat,
    showCompareConsensus,
    ktcRankingIdsByMode,
    compareKtcValueMode,
    showCompareKtc,
    compareImportedLists,
    compareColumnOrder,
  ]);

  return (
    <div className="appViewport">
      {showHowTo && <HowToModal onClose={closeHowTo} />}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 16,
        }}
      >
        {/* Header */}
        <div className="appHeaderWrap">
          <TopBanner
            onExportRankings={exportRankingsXlsxClick}
            onExportCheatsheetPdf={exportCheatsheetPdfClick}
            onImportRankings={importRankingsXlsxClick}
            onOpenHowTo={() => setShowHowTo(true)}
            activeView={activeView}
            onOpenDraftCompanion={() => setActiveView("draftCompanion")}
            onOpenCompareRankings={() => setActiveView("compareRankings")}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            importRankingsXlsxFile(file);
            e.currentTarget.value = "";
          }}
        />

        <input
          ref={compareFileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            importCompareRankingsFile(file);
            e.currentTarget.value = "";
          }}
        />

        {/* Main content */}
        {activeView === "compareRankings" ? (
          <CompareRankingsView
            columns={compareColumns}
            playersById={playersById}
            onImportRankings={importCompareRankingsClick}
            onReorderColumns={onCompareColumnReorder}
            onMoveMyRankings={onCompareMyRankingsMove}
            onRemoveColumn={onRemoveCompareColumn}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "520px max-content",
              gridTemplateRows: "1fr",
              columnGap: 12,
              rowGap: 12,
              flex: 1,
              minHeight: 0,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
                borderRadius: 12,
                padding: 8,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <RankingsList
                rankingsListKey={rankingsListKey}
                setRankingsListKey={setRankingsListKey}
                rankingIds={rankingIds}
                rankingsRankingIds={rankingIdsByList["Rankings"]}
                playersById={playersById}
                tiersByPos={tiersByPos}
                draftedIds={draftedIds}
                onToggleDrafted={toggleDrafted}
                hideKickers={hideKickers}
                setHideKickers={setHideKickers}
                hideDefenses={hideDefenses}
                setHideDefenses={setHideDefenses}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                getColor={posColor}
                onMove={moveRankings}
                ktcValueMode={ktcValueMode}
                onChangeKtcValueMode={setKtcValueMode}
                adpFormat={adpFormat}
                onChangeAdpFormat={setAdpFormat}
                consensusFormat={consensusFormat}
                onChangeConsensusFormat={setConsensusFormat}
                onSetAsRankings={setActiveSourceAsRankings}
              />
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="boardScroll">
                <Board
                  allowRankingsReorder={rankingsListKey === "Rankings"}
                  favoriteIds={favoriteIds}
                  boardTab={boardTab}
                  setBoardTab={setBoardTab}
                  rounds={rounds}
                  setRounds={setRounds}
                  teams={teams}
                  setTeams={setTeams}
                  onAddPlayer={addPlayerToRankings}
                  draftStyle={draftStyle}
                  setDraftStyle={setDraftStyle}
                  rankingIds={boardRankingIds}
                  rankingsRankingIds={rankingIdsByList["Rankings"]}
                  rankingsTiersByPos={tiersByPosByList["Rankings"]}
                  onUpdateRankingsTiersByPos={onUpdateRankingsTiersByPos}
                  playersById={playersById}
                  tiersByPos={boardTiersByPos}
                  onUpdateTiersByPos={onUpdateTiersByPos}
                  draftedIds={draftedIds}
                  onToggleDrafted={toggleDrafted}
                  clearAllDrafted={clearAllDrafted}
                  teamNames={teamNames}
                  setTeamNames={setTeamNames}
                  draftSlots={draftSlots}
                  onAssignPlayerToDraftSlot={assignPlayerToDraftSlot}
                  posColor={posColor}
                  sensors={sensors}
                  onBoardDragEnd={onBoardDragEnd}
                  onDraftBoardDragEnd={onDraftBoardDragEnd}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
