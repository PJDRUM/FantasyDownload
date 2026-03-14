import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TopBannerProps = {
  onExportRankings: () => void;
  onExportCheatsheetPdf: () => void;
  onImportRankings: () => void;
  onOpenHowTo: () => void;
  activeView: "draftCompanion" | "compareRankings";
  onOpenDraftCompanion: () => void;
  onOpenCompareRankings: () => void;
  modeNavLeftPx: number | null;
  showModeNav?: boolean;
};

type PodcastsItem = { label: string; href?: string; imgSrc: string };

const PODCAST_ITEMS: PodcastsItem[] = [
  { label: "Dynasty Domain", href: "https://www.youtube.com/@thedynastydomain", imgSrc: "/Podcasts/DynastyDomain.jpg" },
  {
    label: "The Fantasy Footballers",
    href: "https://www.youtube.com/@TheFantasyFootballers",
    imgSrc: "/Podcasts/TheFantasyFooballers.jpg",
  },
  { label: "TylerFFCreator", href: "https://www.youtube.com/@DynastyAnswers", imgSrc: "/Podcasts/TylerFFCreator.jpg" },
  { label: "The FF Dynasty", href: "https://www.youtube.com/@TheFFDynasty", imgSrc: "/Podcasts/TheFFDynasty.jpg" },
  { label: "The League FFB", href: "https://www.youtube.com/@TheLeagueFFB", imgSrc: "/Podcasts/TheLeagueFFB.jpg" },
  {
    label: "Dynasty League Football",
    href: "https://www.youtube.com/@DynastyLeagueFootball",
    imgSrc: "/Podcasts/DynastyLeagueFootball.jpg",
  },
  { label: "Matt Harmon", href: "https://www.youtube.com/@MattHarmonRP/videos", imgSrc: "/Podcasts/MattHarmon.jpg" },
];

type MenuPhase = "closed" | "open" | "closing";

type PodcastsMenuPos = {
  /** Left position for the dropdown panel (clamped to viewport). */
  panelLeft: number;
  /** Top anchor (button bottom for normal, button top for "open up"). */
  anchorTop: number;
  /** Button center X (used to keep caret pointing at the button). */
  anchorCenterX: number;
  /** Whether the dropdown should open upward to avoid bottom overflow. */
  openUp: boolean;
};

export default function TopBanner({
  onExportRankings,
  onExportCheatsheetPdf,
  onImportRankings,
  onOpenHowTo,
  activeView,
  onOpenDraftCompanion,
  onOpenCompareRankings,
  modeNavLeftPx,
  showModeNav = true,
}: TopBannerProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const podcastsAnchorRef = useRef<HTMLButtonElement>(null);
  const podcastsMenuRef = useRef<HTMLDivElement>(null);

  // The podcasts menu opens only on explicit click, but still uses the existing open/close animation.
  const [podcastsActive, setPodcastsActive] = useState(false);

  // Menu opens immediately on click and closes with the existing "scroll" close animation.
  const [podcastsMenuPhase, setPodcastsMenuPhase] = useState<MenuPhase>("closed");
  const closeAnimTimer = useRef<number | null>(null);

  const [podcastsPos, setPodcastsPos] = useState<PodcastsMenuPos>({
    panelLeft: 0,
    anchorTop: 0,
    anchorCenterX: 0,
    openUp: false,
  });

  const clearMenuTimers = useCallback(() => {
    if (closeAnimTimer.current) window.clearTimeout(closeAnimTimer.current);
    closeAnimTimer.current = null;
  }, []);

  const computePodcastsPosition = useCallback(() => {
    const btn = podcastsAnchorRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();

    const panelWidth = 280;
    const viewportPad = 8;
    const caretSize = 9;

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    const centerX = r.left + r.width / 2;

    // Prefer centering the panel under the button, but clamp to viewport so it never gets cut off.
    const desiredLeft = centerX - panelWidth / 2;
    const minLeft = viewportPad;
    const maxLeft = Math.max(viewportPad, vw - panelWidth - viewportPad);
    const clampedLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);

    // If there's not enough room below for the full menu, open upward (when it helps).
    const menuMaxH = 420;
    const estimatedTotal = caretSize + 2 + menuMaxH; // caret + small margins + panel max
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;

    const openUp = spaceBelow < estimatedTotal && spaceAbove > spaceBelow;

    setPodcastsPos({
      panelLeft: Math.round(clampedLeft),
      anchorTop: Math.round(openUp ? r.top : r.bottom),
      anchorCenterX: Math.round(centerX),
      openUp,
    });
  }, []);

  const isPodcastsVisible = podcastsMenuPhase !== "closed" || podcastsActive;
  const menuOpen = podcastsMenuPhase === "open";
  const menuClosing = podcastsMenuPhase === "closing";

  useLayoutEffect(() => {
    if (!isPodcastsVisible) return;
    computePodcastsPosition();
  }, [isPodcastsVisible, computePodcastsPosition]);

  useEffect(() => {
    computePodcastsPosition();
  }, [computePodcastsPosition]);

  useEffect(() => {
    const onScrollOrResize = () => computePodcastsPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [computePodcastsPosition]);

  // Settings: click outside + ESC
  useEffect(() => {
    if (!settingsOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) setSettingsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const openPodcasts = useCallback(() => {
    clearMenuTimers();
    computePodcastsPosition();
    setPodcastsActive(true);
    setPodcastsMenuPhase("open");
  }, [clearMenuTimers, computePodcastsPosition]);

  const closePodcasts = useCallback(() => {
    setPodcastsActive(false);
    clearMenuTimers();

    if (podcastsMenuPhase === "closed") return;
    setPodcastsMenuPhase("closing");
    closeAnimTimer.current = window.setTimeout(() => {
      setPodcastsMenuPhase("closed");
      closeAnimTimer.current = null;
    }, 560);
  }, [podcastsMenuPhase, clearMenuTimers]);

  const togglePodcasts = useCallback(() => {
    if (menuOpen || menuClosing) {
      closePodcasts();
      return;
    }

    openPodcasts();
  }, [menuOpen, menuClosing, openPodcasts, closePodcasts]);

  // Keep podcasts menu positioned and avoid flicker on fast transitions.
  useEffect(() => {
    if (!isPodcastsVisible) return;
    computePodcastsPosition();
  }, [podcastsMenuPhase, podcastsActive, isPodcastsVisible, computePodcastsPosition]);

  useEffect(() => {
    if (!isPodcastsVisible) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (podcastsAnchorRef.current?.contains(target)) return;
      if (podcastsMenuRef.current?.contains(target)) return;
      closePodcasts();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePodcasts();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isPodcastsVisible, closePodcasts]);

  const podcastsPortal = useMemo(() => {
    if (!isPodcastsVisible) return null;
    if (typeof document === "undefined") return null;

    const panelWidth = 280;
    const caretSize = 9;

    const caretStyleUp: React.CSSProperties = {
      width: 0,
      height: 0,
      borderLeft: `${caretSize}px solid transparent`,
      borderRight: `${caretSize}px solid transparent`,
      borderBottom: `${caretSize}px solid #ffffff`,
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.35))",
      transition: "opacity 360ms ease, transform 360ms ease",
      opacity: podcastsActive ? 1 : 0,
      transform: podcastsActive ? "translateY(0px)" : "translateY(8px)",
      pointerEvents: "none",
    };

    const caretStyleDown: React.CSSProperties = {
      width: 0,
      height: 0,
      borderLeft: `${caretSize}px solid transparent`,
      borderRight: `${caretSize}px solid transparent`,
      borderTop: `${caretSize}px solid #ffffff`,
      filter: "drop-shadow(0 -8px 18px rgba(0,0,0,0.35))",
      transition: "opacity 360ms ease, transform 360ms ease",
      opacity: podcastsActive ? 1 : 0,
      transform: podcastsActive ? "translateY(0px)" : "translateY(-8px)",
      pointerEvents: "none",
    };

    const panelVisible = menuOpen || menuClosing;
    const panelScaleY = menuOpen ? 1 : 0.03;
    const panelMaxH = menuOpen ? 420 : 0;

    // Keep the caret pointing at the button even when the panel is clamped.
    const desiredCaretLeft = podcastsPos.anchorCenterX - podcastsPos.panelLeft - caretSize;
    const caretClampPad = 12;
    const caretLeft = Math.min(
      Math.max(desiredCaretLeft, caretClampPad),
      panelWidth - caretClampPad - caretSize * 2
    );

    const caret = (
      <div
        style={{
          width: panelWidth,
          display: "flex",
          justifyContent: "flex-start",
          position: "relative",
          marginTop: podcastsPos.openUp ? 0 : 2,
          marginBottom: podcastsPos.openUp ? 2 : 0,
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "absolute", left: caretLeft, top: 0 }}>
          <div style={podcastsPos.openUp ? caretStyleDown : caretStyleUp} />
        </div>
      </div>
    );

    const panel = (
      <div
        style={{
          width: panelWidth,
          background: "#ffffff",
          borderRadius: 3,
          boxShadow: "0 16px 42px rgba(0,0,0,0.45)",
          overflow: "hidden",
          transformOrigin: podcastsPos.openUp ? "bottom" : "top",
          transform: `scaleY(${panelScaleY})`,
          maxHeight: panelMaxH,
          // IMPORTANT: no fade out on close — only "scroll" closed.
          transition: menuOpen
            ? "transform 320ms ease, max-height 340ms ease"
            : "transform 560ms ease, max-height 560ms ease",
          pointerEvents: panelVisible ? "auto" : "none",
        }}
      >
        <div style={{ padding: 10 }}>
          {PODCAST_ITEMS.map((it) => (
            <div
              key={it.label}
              role="menuitem"
              tabIndex={-1}
              style={{
                padding: "10px 12px",
                fontSize: 22,
                fontWeight: 900,
                color: "#111",
                cursor: "pointer",
                borderRadius: 10,
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
              onClick={() => {
                closePodcasts();
                if (it.href) window.open(it.href, "_blank", "noopener,noreferrer");
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={it.imgSrc}
                  alt={it.label}
                  draggable={false}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    objectFit: "cover",
                    flex: "0 0 auto",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
                  }}
                />
                <span style={{ lineHeight: 1 }}>{it.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    return createPortal(
      <div
        ref={podcastsMenuRef}
        style={{
          position: "fixed",
          left: podcastsPos.panelLeft,
          top: podcastsPos.anchorTop,
          width: panelWidth,
          zIndex: 100000,
          pointerEvents: "auto",
        }}
      >
        {podcastsPos.openUp ? (
          <>
            {/* Panel above, caret below */}
            <div style={{ transform: "translateY(-2px)" }}>{panel}</div>
            {caret}
          </>
        ) : (
          <>
            {/* Caret above, panel below */}
            {caret}
            <div style={{ transform: "translateY(-2px)" }}>{panel}</div>
          </>
        )}
      </div>,
      document.body
    );
  }, [
    isPodcastsVisible,
    podcastsActive,
    podcastsPos.panelLeft,
    podcastsPos.anchorTop,
    podcastsPos.anchorCenterX,
    podcastsPos.openUp,
    menuOpen,
    menuClosing,
    closePodcasts,
  ]);

  const navBtnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    border: "none",
    borderRadius: 0,
    transition: "background 260ms ease",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 900,
    fontSize: 18,
    textShadow: "0 10px 26px rgba(0,0,0,0.65)",
    whiteSpace: "nowrap",
    background: "transparent",
  };

  return (
    <div style={{ position: "relative", zIndex: 20 }}>
      {/* Full-width banner: square edges, touches TopLinksBar */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          borderRadius: 0,
          border: "none",
          overflow: "visible",
          boxShadow: "none",
          background: "linear-gradient(90deg, #000000 0%, #000814 35%, #001d3d 70%, #003566 100%)",
        }}
      >
        {/* Left logo area */}
        <div
          style={{
            background: "transparent",
            display: "flex",
            alignItems: "center",
            padding: "10px 14px",
          }}
        >
          <a
            href="https://fantasydownload.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="The Fantasy Footballers"
            style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
          >
            <img
              src="/FantasyFootballersLogo.png"
              alt="The Fantasy Footballers"
              style={{
                height: 75,
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.65))",
              }}
              draggable={false}
            />
          </a>
        </div>

        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Right actions: Podcasts next to Settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
          <button
            ref={podcastsAnchorRef}
            onClick={togglePodcasts}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              ...navBtnBase,
              cursor: "pointer",
              background: isPodcastsVisible ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            <span>Podcasts</span>
            {/* Chevron should point DOWN */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginLeft: -1 }}>
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div ref={settingsMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              title="Settings"
              aria-label="Settings"
              style={{
                width: 42,
                height: 42,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg)",
                color: "var(--text-0)",
                cursor: "pointer",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M4 12h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M4 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>

            {settingsOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 52,
                  minWidth: 190,
                  padding: 6,
                  borderRadius: 14,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg)",
                  boxShadow: "var(--shadow-0)",
                  zIndex: 5000,
                }}
              >
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    onExportRankings();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-0)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Export Rankings
                </button>

                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    onExportCheatsheetPdf();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Export Cheatsheet (PDF)
                </button>

                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    onImportRankings();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-0)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Import Rankings
                </button>

                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    onOpenHowTo();
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: "var(--text-0)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  How-to
                </button>
              </div>
            )}
          </div>
        </div>

        {showModeNav && (
          <div
            style={{
              position: "absolute",
              left: modeNavLeftPx != null ? modeNavLeftPx : 420,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "none",
              width: 470,
            }}
          >
            <button
              type="button"
              onClick={onOpenDraftCompanion}
              style={{
                ...navBtnBase,
                cursor: "pointer",
                background: activeView === "draftCompanion" ? "rgba(255,255,255,0.12)" : "transparent",
                pointerEvents: "auto",
                width: 220,
                justifyContent: "center",
              }}
            >
              <span>Draft Companion</span>
            </button>

            <button
              type="button"
              onClick={onOpenCompareRankings}
              style={{
                ...navBtnBase,
                cursor: "pointer",
                background: activeView === "compareRankings" ? "rgba(255,255,255,0.12)" : "transparent",
                pointerEvents: "auto",
                width: 220,
                justifyContent: "center",
              }}
            >
              <span>Compare Rankings</span>
            </button>
          </div>
        )}
      </div>

      {podcastsPortal}
    </div>
  );
}
