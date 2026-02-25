import { useEffect, useState } from "react";

export function useDraft(args: {
  rankingIds: string[];
  teams: number;
}) {
  const { rankingIds, teams } = args;

  const rounds = Math.ceil(rankingIds.length / teams);
  const totalDraftSlots = rounds * teams;

  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set());
  const [draftedOrder, setDraftedOrder] = useState<string[]>([]);
  const [draftSlots, setDraftSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: totalDraftSlots }, () => null)
  );

  // keep slots sized correctly + deduped
  useEffect(() => {
    setDraftSlots((prev) => {
      const next = Array.from(
        { length: totalDraftSlots },
        (_, i) => prev[i] ?? null
      );

      const seen = new Set<string>();
      for (let i = 0; i < next.length; i++) {
        const v = next[i];
        if (!v) continue;
        if (seen.has(v)) next[i] = null;
        else seen.add(v);
      }

      return next;
    });
  }, [totalDraftSlots]);

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

  function swapDraftSlots(from: number, to: number) {
    setDraftSlots((prev) => {
      const next = [...prev];
      const tmp = next[from] ?? null;
      next[from] = next[to] ?? null;
      next[to] = tmp;
      return next;
    });
  }

  return {
    rounds,
    totalDraftSlots,
    draftedIds,
    draftedOrder,
    draftSlots,
    toggleDrafted,
    clearAllDrafted,
    swapDraftSlots,
  };
}
