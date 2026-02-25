// src/components/Rankings/Headshot.tsx
import React, { useEffect, useRef, useState } from "react";

const PLACEHOLDER_SRC = "/headshot-placeholder.svg";

export default function Headshot({
  src,
  alt,
}: {
  src?: string;
  alt: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Reset whenever the src changes
    setShouldLoad(false);
  }, [src]);

  useEffect(() => {
    if (!src) return;

    const el = imgRef.current;
    if (!el) return;

    // If IntersectionObserver isn't available, fall back to eager loading.
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldLoad(true);
            obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  // No src provided: always show placeholder (no remote loads).
  if (!src) {
    return (
      <img
        src={PLACEHOLDER_SRC}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{
          width: 35,
          height: 35,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid rgba(0,0,0,0.25)",
          background: "rgba(255,255,255,0.6)",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <img
      ref={imgRef}
      src={shouldLoad ? src : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        width: 35,
        height: 35,
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid rgba(0,0,0,0.25)",
        background: "rgba(255,255,255,0.6)",
        flexShrink: 0,
      }}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;

        // Swap to placeholder once; if placeholder fails too, hide.
        if (!img.src.includes(PLACEHOLDER_SRC)) {
          img.src = PLACEHOLDER_SRC;
        } else {
          img.style.display = "none";
        }
      }}
    />
  );
}
