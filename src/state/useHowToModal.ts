import { useEffect, useState } from "react";

const STORAGE_KEY = "fantasy-board:howto:v1";

export function useHowToModal() {
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const already =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : "1";

    if (!already) setShowHowTo(true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHowTo(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeHowTo() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShowHowTo(false);
  }

  return {
    showHowTo,
    setShowHowTo,
    closeHowTo,
  };
}
