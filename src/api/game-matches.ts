import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  GameMatchCreateInput,
  GameMatchDetail,
  GameMatchSummary,
} from "./types";

/**
 * Parties de jeu hors tournoi (`/game-matches`). Rien n'est mis en cache ici :
 * une partie qu'on vient d'enregistrer doit apparaître au retour sur la liste.
 */

export function listMyGameMatches(limit?: number): Promise<GameMatchSummary[]> {
  return api
    .get<{ matches: GameMatchSummary[] }>(endpoints.gameMatches.list, { limit })
    .then((r) => r.matches ?? []);
}

export function getGameMatch(matchId: string): Promise<GameMatchDetail> {
  return api.get<GameMatchDetail>(endpoints.gameMatches.detail(matchId));
}

export function createGameMatch(input: GameMatchCreateInput): Promise<GameMatchDetail> {
  return api.post<GameMatchDetail>(endpoints.gameMatches.list, input);
}
