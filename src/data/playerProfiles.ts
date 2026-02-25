import rawProfiles from "./playerProfiles.json";

export type PlayerProfileEntry = {
  podcast: string;
  label: string; // e.g. "2/11/26"
  url: string; // YouTube (or any) link
};

// Back-compat with earlier component imports
export type PlayerProfileLink = PlayerProfileEntry;

export type PlayerProfilesIndex = Record<string, PlayerProfileEntry[]>;

const playerProfiles: PlayerProfilesIndex =
  (rawProfiles as unknown as PlayerProfilesIndex) ?? {};

// Back-compat named export
export const playerProfilesById: PlayerProfilesIndex = playerProfiles;

export function getPlayerProfiles(playerId: string): PlayerProfileEntry[] {
  return playerProfiles[playerId] ?? [];
}

export default playerProfiles;
