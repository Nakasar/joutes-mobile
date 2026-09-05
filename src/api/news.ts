import { api } from "./client";
import { endpoints } from "./endpoints";
import type { News, NewsListResponse } from "./types";
import { withCache } from "../lib/response-cache";

export interface ListNewsParams {
  /** Un jeu, ou plusieurs — le fil de qui suit plusieurs jeux les demande ensemble. */
  gameId?: string | readonly string[];
  tag?: string;
  page?: number;
  limit?: number;
}

export function listNews(params: ListNewsParams = {}): Promise<NewsListResponse> {
  // Clé déterministe : tuple à ordre fixe plutôt que `JSON.stringify(params)`,
  // dont l'ordre des propriétés dépend de l'appelant (sinon des entrées de
  // cache dupliquées pour une même requête logique).
  const gameKey = Array.isArray(params.gameId) ? params.gameId.join(",") : params.gameId;
  const key = [gameKey, params.tag, params.page, params.limit].join("|");
  return withCache(`news:list:${key}`, () =>
    api.get<NewsListResponse>(endpoints.news.list, { ...params }),
  );
}

export function getNews(newsId: string): Promise<News> {
  return withCache(`news:detail:${newsId}`, () =>
    api.get<News>(endpoints.news.detail(newsId)),
  );
}

export function toggleNewsLike(newsId: string): Promise<unknown> {
  return api.post(endpoints.news.like(newsId), {});
}
