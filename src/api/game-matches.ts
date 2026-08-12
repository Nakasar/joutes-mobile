import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  BattleMap,
  GameMatchCreateInput,
  GameMatchDetail,
  GameMatchListResult,
} from "./types";

/**
 * Parties de jeu hors tournoi (`/game-matches`). Rien n'est mis en cache ici :
 * une partie qu'on vient d'enregistrer doit apparaître au retour sur la liste.
 */

export interface GameMatchListParams {
  page?: number;
  limit?: number;
  gameId?: string;
  /** Jouée à partir de ce jour (`AAAA-MM-JJ`), borne incluse. */
  from?: string;
  /** Jouée jusqu'à ce jour compris. */
  to?: string;
}

export function listMyGameMatches(
  params: GameMatchListParams = {},
): Promise<GameMatchListResult> {
  return api
    .get<Partial<GameMatchListResult>>(endpoints.gameMatches.list, {
      page: params.page,
      limit: params.limit,
      gameId: params.gameId,
      from: params.from,
      to: params.to,
    })
    .then((response) => ({
      matches: response.matches ?? [],
      total: response.total ?? response.matches?.length ?? 0,
      page: response.page ?? params.page ?? 1,
      limit: response.limit ?? params.limit ?? 0,
      // Une API antérieure à la pagination ne rend pas de total : une seule
      // page, alors, plutôt qu'un bouton « charger plus » qui ne chargerait rien.
      totalPages: response.totalPages ?? 1,
    }));
}

export function getGameMatch(matchId: string): Promise<GameMatchDetail> {
  return api.get<GameMatchDetail>(endpoints.gameMatches.detail(matchId));
}

export function createGameMatch(input: GameMatchCreateInput): Promise<GameMatchDetail> {
  return api.post<GameMatchDetail>(endpoints.gameMatches.list, input);
}

/**
 * Rejoint une partie sur invitation (QR code scanné). Rejoindre deux fois n'est
 * pas une erreur : `joined` vaut alors `false`, et la partie est rendue quand
 * même.
 */
export function joinGameMatch(
  matchId: string,
): Promise<{ joined: boolean; match: GameMatchDetail }> {
  return api.post<{ joined: boolean; match: GameMatchDetail }>(
    endpoints.gameMatches.join(matchId),
  );
}

/**
 * Écrit la table de jeu **d'un bloc** — ses pièces se tiennent les unes les
 * autres. Le serveur la normalise (jetons ramenés sur le plateau, décors,
 * jetons et instants plafonnés) et rend ce qu'il a retenu : c'est cette
 * version-là que l'écran doit afficher ensuite, pas celle qu'il a envoyée.
 */
export function updateBattleMap(matchId: string, map: BattleMap): Promise<BattleMap> {
  return api
    .put<{ map: BattleMap }>(endpoints.gameMatches.battleMap(matchId), { map })
    .then((response) => response.map);
}
