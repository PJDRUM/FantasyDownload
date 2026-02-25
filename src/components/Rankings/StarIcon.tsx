import React from "react";

export type FavoriteStarStyle = {
  /** px from the player row's top-left corner */
  leftPx: number;
  /** px from the player row's top-left corner */
  topPx: number;
  /** SVG width/height (px) */
  sizePx: number;
  /** Stroke thickness (px) */
  borderPx: number;
};

export const StarIcon = (props: {
  filled: boolean;
  sizePx: number;
  borderPx: number;
  color: string;
  outlineColor: string;
}) => {
  const { filled, sizePx, borderPx, color, outlineColor } = props;

  // Convert desired pixel stroke thickness into SVG viewBox units.
  // viewBox is 24x24, so 1 viewBox unit = sizePx/24 px.
  const strokeW = Math.max(0.5, (borderPx * 24) / Math.max(1, sizePx));

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={filled ? color : "none"}
        stroke={outlineColor}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
    </svg>
  );
};
