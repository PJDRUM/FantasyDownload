const TEAM_ABBREVIATION_OVERRIDES: Record<string, string> = {
  ARZ: "ARI",
  JAC: "JAX",
  NWE: "NE",
  NOR: "NO",
  TAM: "TB",
  GNB: "GB",
  KAN: "KC",
  SFO: "SF",
  WAS: "WSH",
  WFT: "WSH",
  OAK: "LV",
  LVR: "LV",
  SD: "LAC",
  STL: "LAR",
  LA: "LAR",
  NEP: "NE",
  NOS: "NO",
  TBB: "TB",
  GBP: "GB",
  KCC: "KC",
};

const TEAM_LOGO_KEYS: Record<string, string> = {
  ARI: "ari",
  ATL: "atl",
  BAL: "bal",
  BUF: "buf",
  CAR: "car",
  CHI: "chi",
  CIN: "cin",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GB: "gb",
  HOU: "hou",
  IND: "ind",
  JAX: "jax",
  KC: "kc",
  LV: "lv",
  LAC: "lac",
  LAR: "lar",
  MIA: "mia",
  MIN: "min",
  NE: "ne",
  NO: "no",
  NYG: "nyg",
  NYJ: "nyj",
  PHI: "phi",
  PIT: "pit",
  SEA: "sea",
  SF: "sf",
  TB: "tb",
  TEN: "ten",
  WSH: "wsh",
};

export function formatTeamAbbreviation(team: unknown, fallback = ""): string {
  const value = String(team ?? "").trim();
  if (!value) return fallback;

  const normalized = value.toUpperCase();
  return TEAM_ABBREVIATION_OVERRIDES[normalized] ?? normalized;
}

export function getTeamLogoSrc(team: unknown): string | null {
  const abbreviation = formatTeamAbbreviation(team);
  const key = TEAM_LOGO_KEYS[abbreviation];
  return key ? `/team-logos/nfl/${key}.png` : null;
}
