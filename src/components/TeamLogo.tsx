import React from "react";
import { formatTeamAbbreviation, getTeamLogoSrc } from "../utils/teamAbbreviation";

export default function TeamLogo(props: {
  team: unknown;
  size?: number;
  title?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}) {
  const { team, size = 16, title, style, fallback = null } = props;
  const abbreviation = formatTeamAbbreviation(team);
  const src = getTeamLogoSrc(team);

  if (!src) {
    const fallbackElement = fallback as React.ReactElement<{ style?: React.CSSProperties }> | null;
    const fallbackNode = React.isValidElement(fallbackElement)
      ? React.cloneElement(fallbackElement, {
          style: {
            ...(fallbackElement.props?.style ?? {}),
            fontSize: size * 0.425,
            lineHeight: 1,
          },
        })
      : fallback;

    return (
      <span
        title={title ?? abbreviation}
        style={{
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          verticalAlign: "middle",
          ...style,
        }}
      >
        {fallbackNode}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={abbreviation ? `${abbreviation} logo` : "Team logo"}
      title={title ?? abbreviation}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        flex: "0 0 auto",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}
