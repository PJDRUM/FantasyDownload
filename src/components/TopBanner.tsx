import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TopBannerProps = {
  onExportRankings: () => void;
  onExportCheatsheetPdf: () => void;
  onImportRankings: () => void;
  onOpenHowTo: () => void;
  onOpenDraftSync: () => void;
  activeView: "draftCompanion" | "compareRankings";
  onOpenDraftCompanion: () => void;
  onOpenCompareRankings: () => void;
  modeNavLeftPx: number | null;
  showModeNav?: boolean;
  uiScale?: number;
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
  onOpenDraftSync,
  activeView,
  onOpenDraftCompanion,
  onOpenCompareRankings,
  modeNavLeftPx,
  showModeNav = true,
  uiScale = 1,
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
    justifyContent: "center",
    gap: 6 * uiScale,
    padding: `${8 * uiScale}px 0`,
    border: "none",
    borderRadius: 0,
    transition: "color 180ms ease, opacity 180ms ease",
    color: "rgba(245,247,255,0.74)",
    fontWeight: 700,
    fontSize: 16 * uiScale,
    whiteSpace: "nowrap",
    background: "transparent",
    letterSpacing: "0.02em",
  };

  const actionBtnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8 * uiScale,
    minHeight: 32 * uiScale,
    padding: `${8 * uiScale}px 0`,
    borderRadius: 0,
    border: "none",
    background: "transparent",
    color: "rgba(245,247,255,0.76)",
    fontWeight: 700,
    fontSize: 15 * uiScale,
    lineHeight: 1,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "color 180ms ease, opacity 180ms ease",
  };

  return (
    <div style={{ position: "relative", zIndex: 20 }}>
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(220px, auto) minmax(0, 1fr) minmax(220px, auto)",
          alignItems: "center",
          gap: 16 * uiScale,
          padding: `${12 * uiScale}px ${20 * uiScale}px`,
          borderRadius: 0,
          border: "none",
          overflow: "visible",
          boxShadow: "none",
          background:
            "linear-gradient(135deg, rgba(7,10,18,0.96) 0%, rgba(10,18,34,0.94) 52%, rgba(16,39,68,0.92) 100%)",
          backdropFilter: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <a
            href="https://fantasydownload.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="FantasyDownload"
            style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", maxWidth: "100%" }}
          >
            <img
              src="/fantasydownloadlogo.png"
              alt="FantasyDownload"
              style={{
                height: 60 * uiScale,
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.42))",
              }}
              draggable={false}
            />
          </a>
        </div>
        {showModeNav ? (
          <div style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 26 * uiScale,
              }}
            >
              <button
                type="button"
                onClick={onOpenDraftCompanion}
                style={{
                  ...navBtnBase,
                  cursor: "pointer",
                  position: "relative",
                  color: activeView === "draftCompanion" ? "#ffffff" : "rgba(245,247,255,0.72)",
                  opacity: activeView === "draftCompanion" ? 1 : 0.88,
                }}
              >
                <span>Draft Companion</span>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -6 * uiScale,
                    height: 2 * uiScale,
                    borderRadius: 999,
                    background: activeView === "draftCompanion" ? "rgba(255,255,255,0.92)" : "transparent",
                  }}
                />
              </button>

              <button
                type="button"
                onClick={onOpenCompareRankings}
                style={{
                  ...navBtnBase,
                  cursor: "pointer",
                  position: "relative",
                  color: activeView === "compareRankings" ? "#ffffff" : "rgba(245,247,255,0.72)",
                  opacity: activeView === "compareRankings" ? 1 : 0.88,
                }}
              >
                <span>Compare Rankings</span>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -6 * uiScale,
                    height: 2 * uiScale,
                    borderRadius: 999,
                    background: activeView === "compareRankings" ? "rgba(255,255,255,0.92)" : "transparent",
                  }}
                />
              </button>
            </div>
          </div>
        ) : (
          <div />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 22 * uiScale, minWidth: 0 }}>
          <button type="button" onClick={onOpenDraftSync} style={actionBtnBase}>
            <span>Sync Sleeper</span>
          </button>

          <button
            ref={podcastsAnchorRef}
            onClick={togglePodcasts}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              ...actionBtnBase,
              color: isPodcastsVisible ? "#ffffff" : "rgba(245,247,255,0.76)",
              opacity: isPodcastsVisible ? 1 : 0.92,
            }}
          >
            <span>Podcasts</span>
            <svg width={16 * uiScale} height={16 * uiScale} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div ref={settingsMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              title="Settings"
              aria-label="Settings"
              style={{
                ...actionBtnBase,
                width: 24 * uiScale,
                minWidth: 24 * uiScale,
                minHeight: 24 * uiScale,
                padding: 0,
                color: settingsOpen ? "#ffffff" : "rgba(245,247,255,0.76)",
                opacity: settingsOpen ? 1 : 0.9,
              }}
            >
              <svg width={18 * uiScale} height={18 * uiScale} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                <path d="M4 12h16" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                <path d="M4 18h16" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
              </svg>
            </button>

            {settingsOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 52 * uiScale,
                  minWidth: 220 * uiScale,
                  padding: 8 * uiScale,
                  borderRadius: 18 * uiScale,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(10,15,26,0.98)",
                  boxShadow: "0 22px 44px rgba(0,0,0,0.35)",
                  zIndex: 5000,
                  backdropFilter: "blur(16px)",
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
                    padding: `${12 * uiScale}px ${14 * uiScale}px`,
                    borderRadius: 14 * uiScale,
                    border: "none",
                    background: "transparent",
                    color: "rgba(248,250,255,0.92)",
                    fontWeight: 800,
                    fontSize: 14 * uiScale,
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
                    padding: `${12 * uiScale}px ${14 * uiScale}px`,
                    borderRadius: 14 * uiScale,
                    border: "none",
                    background: "transparent",
                    color: "rgba(248,250,255,0.92)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14 * uiScale,
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
                    padding: `${12 * uiScale}px ${14 * uiScale}px`,
                    borderRadius: 14 * uiScale,
                    border: "none",
                    background: "transparent",
                    color: "rgba(248,250,255,0.92)",
                    fontWeight: 800,
                    fontSize: 14 * uiScale,
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
                    padding: `${12 * uiScale}px ${14 * uiScale}px`,
                    borderRadius: 14 * uiScale,
                    border: "none",
                    background: "transparent",
                    color: "rgba(248,250,255,0.92)",
                    fontWeight: 800,
                    fontSize: 14 * uiScale,
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
      </div>

      {podcastsPortal}
    </div>
  );
}
