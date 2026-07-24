import type { GameTypeKey } from "../api/types";

/** Ordre d'affichage canonique, aligné sur `lib/constants/game-types.ts` côté joutes-app. */
export const GAME_TYPE_ORDER: GameTypeKey[] = [
  "TCG",
  "BoardGame",
  "VideoGame",
  "Miniatures",
  "Other",
];

const KNOWN_TYPES: string[] = GAME_TYPE_ORDER;

/** Position dans l'ordre canonique (types inconnus ou absents relégués en fin de liste). */
export function gameTypeOrderIndex(type: string | undefined): number {
  if (!type) return GAME_TYPE_ORDER.length;
  const index = GAME_TYPE_ORDER.indexOf(type as GameTypeKey);
  return index === -1 ? GAME_TYPE_ORDER.length : index;
}

export function isKnownGameType(type: string): boolean {
  return KNOWN_TYPES.includes(type);
}
