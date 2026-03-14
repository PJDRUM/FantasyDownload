import React from "react";

function getTouchDistance(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

export function useFitZoomViewport(enabled: boolean) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const pinchStateRef = React.useRef<{ distance: number; scale: number } | null>(null);
  const [baseScale, setBaseScale] = React.useState(1);
  const [userScale, setUserScale] = React.useState(1);
  const [contentSize, setContentSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!enabled) {
      setBaseScale(1);
      setUserScale(1);
      return;
    }

    const updateScale = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      const nextWidth = content.scrollWidth;
      const nextHeight = content.scrollHeight;
      const availableWidth = viewport.clientWidth;

      setContentSize({ width: nextWidth, height: nextHeight });
      setBaseScale(nextWidth > 0 && availableWidth > 0 ? Math.min(1, availableWidth / nextWidth) : 1);
    };

    updateScale();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null;
    if (resizeObserver) {
      if (viewportRef.current) resizeObserver.observe(viewportRef.current);
      if (contentRef.current) resizeObserver.observe(contentRef.current);
    } else {
      window.addEventListener("resize", updateScale);
    }

    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", updateScale);
    };
  }, [enabled]);

  const totalScale = enabled ? baseScale * userScale : 1;

  const onTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!enabled || event.touches.length !== 2) return;
      pinchStateRef.current = {
        distance: getTouchDistance(event.touches),
        scale: userScale,
      };
    },
    [enabled, userScale]
  );

  const onTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!enabled || event.touches.length !== 2 || !pinchStateRef.current) return;
      const nextDistance = getTouchDistance(event.touches);
      if (!nextDistance || !pinchStateRef.current.distance) return;

      event.preventDefault();
      const nextScale = pinchStateRef.current.scale * (nextDistance / pinchStateRef.current.distance);
      setUserScale(Math.min(3, Math.max(1, nextScale)));
    },
    [enabled]
  );

  const onTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchStateRef.current = null;
  }, []);

  return {
    viewportRef,
    contentRef,
    contentSize,
    totalScale,
    touchHandlers: enabled
      ? {
          onTouchStart,
          onTouchMove,
          onTouchEnd,
          onTouchCancel: onTouchEnd,
        }
      : {},
  };
}
