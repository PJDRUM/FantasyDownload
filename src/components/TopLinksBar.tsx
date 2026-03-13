// src/components/TopLinksBar.tsx
import React from "react";

// Toggle to remove the TopLinksBar entirely (renders nothing).
const HIDE_TOPLINKSBAR = true;
const SHOW_DISCORD_ONLY_WHEN_HIDDEN = true;

type PrimaryLinkItem = {
  text: string;
  href: string;
  iconSrc?: string;
  iconAlt?: string;
};

type SocialLinkItem = {
  ariaLabel: string;
  href: string;
  iconSrc: string;
};

const PRIMARY_LINKS: PrimaryLinkItem[] = [
  {
    text: "#1 Fantasy Football Podcast",
    href: "https://www.thefantasyfootballers.com/fantasy-football-podcast/",
  },
  {
    text: "Ballers Shop",
    href: "https://www.shopballers.com/",
    iconSrc: "/topbar-icons/nav-shop.png",
    iconAlt: "",
  },
  {
    text: "Join the FootClan",
    href: "https://www.thefantasyfootballers.com/join-the-footclan/",
    iconSrc: "/topbar-icons/nav-footclan.png",
    iconAlt: "",
  },
  {
    text: "My Teams",
    href: "https://www.thefantasyfootballers.com/teams/",
    iconSrc: "/topbar-icons/nav-teams.png",
    iconAlt: "",
  },
  {
    text: "My Account",
    href: "https://www.thefantasyfootballers.com/account/",
    iconSrc: "/topbar-icons/nav-account.png",
    iconAlt: "",
  },
];

const SOCIAL_LINKS: SocialLinkItem[] = [
  {
    ariaLabel: "Discord",
    href: "https://discord.gg/XJts7K3v",
    iconSrc: "/topbar-icons/social-discord.png",
  },
  {
    ariaLabel: "Instagram",
    href: "https://www.instagram.com/fantasyfootballers",
    iconSrc: "/topbar-icons/social-instagram.png",
  },
  {
    ariaLabel: "X",
    href: "https://www.x.com/theffballers",
    iconSrc: "/topbar-icons/social-x.png",
  },
  {
    ariaLabel: "YouTube",
    href: "https://www.youtube.com/thefantasyfootballers",
    iconSrc: "/topbar-icons/social-youtube.png",
  },
  {
    ariaLabel: "TikTok",
    href: "https://www.tiktok.com/@fantasyfootballpodcast",
    iconSrc: "/topbar-icons/social-tiktok.png",
  },
];

function TopbarImg({
  src,
  className,
  alt = "",
}: {
  src: string;
  className: string;
  alt?: string;
}) {
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" />;
}

export default function TopLinksBar() {
  const socialLinksToRender = HIDE_TOPLINKSBAR && SHOW_DISCORD_ONLY_WHEN_HIDDEN
    ? SOCIAL_LINKS.filter((item) => item.ariaLabel === "Discord")
    : SOCIAL_LINKS;

  if (HIDE_TOPLINKSBAR && socialLinksToRender.length === 0) return null;

  return (
    <div className="topLinksBar" role="navigation" aria-label="Top links">
      <div className="topLinksInner">
        {!HIDE_TOPLINKSBAR && (
          <div className="topLinksPrimary">
            {PRIMARY_LINKS.map((item) => (
              <a
                key={item.href}
                className="topLinksPrimaryItem"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.iconSrc ? (
                  <TopbarImg src={item.iconSrc} className="topLinksIconImg" alt={item.iconAlt ?? ""} />
                ) : null}
                <span>{item.text}</span>
              </a>
            ))}
          </div>
        )}

        <div className="topLinksSocial" aria-label="Social links">
          {socialLinksToRender.map((item) => (
            <a
              key={item.href}
              className="topLinksSocialItem"
              href={item.href}
              aria-label={item.ariaLabel}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TopbarImg src={item.iconSrc} className="topLinksSocialIconImg" alt="" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
