import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Game, GameLive, GameSocialPost, GameSummary } from "./types";
import { withCache } from "../lib/response-cache";

export function listGames(): Promise<GameSummary[]> {
  return withCache("games:list", () =>
    api.get<GameSummary[]>(endpoints.games.list),
  );
}

export function getGame(idOrSlug: string): Promise<Game> {
  return withCache(`games:detail:${idOrSlug}`, () =>
    api.get<Game>(endpoints.games.detail(idOrSlug)),
  );
}

/**
 * Le direct de l'éditeur — `GET /games/{id}/live`.
 *
 * **Sans cache** : c'est le seul contenu périssable de la fiche, et servir un
 * direct terminé depuis IndexedDB serait pire que ne rien montrer.
 */
export function getGameLive(idOrSlug: string): Promise<GameLive | null> {
  return api.get<{ live: GameLive | null }>(endpoints.games.live(idOrSlug)).then((r) => r.live);
}

/**
 * Les publications de l'éditeur — `GET /games/{id}/social-posts`.
 *
 * `withCache` : elles ne bougent que deux fois par jour, au rythme de la
 * collecte, et se relisent hors ligne comme le reste de la fiche. Un jeu sans
 * fanion `socialFeed` répond 404 : l'appelant le sait et ne demande pas.
 */
export function listGameSocialPosts(idOrSlug: string, limit?: number): Promise<GameSocialPost[]> {
  return withCache(`games:social:${idOrSlug}:${limit ?? ""}`, () =>
    api
      .get<{ posts: GameSocialPost[] }>(endpoints.games.socialPosts(idOrSlug), limit ? { limit } : undefined)
      .then((r) => r.posts ?? []),
  );
}
