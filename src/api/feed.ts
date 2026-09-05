import { api } from "./client";
import { endpoints } from "./endpoints";
import type { HomeFeed } from "./types";
import { withCache } from "../lib/response-cache";

export interface HomeFeedParams {
  /** Identifiant ou slug ; absent, les jeux suivis (tout pour un visiteur). */
  gameId?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  place?: string;
  lang?: string;
  limit?: number;
}

/**
 * L'accueil en une requête — `GET /feed`.
 *
 * `withCache` sous une clé qui dit **qui** regarde : le même fil ne vaut pas
 * pour un visiteur et pour un compte, et IndexedDB ne connaît pas la session.
 * Le suivi d'un jeu purge le préfixe (`cacheDeleteByPrefix("home:feed:")`).
 */
export function getHomeFeed(params: HomeFeedParams, viewerId: string | null): Promise<HomeFeed> {
  const { lat, lon, ...rest } = params;
  const near = lat !== undefined && lon !== undefined;
  const query = { ...rest, ...(near ? { lat, lon } : {}) };
  const key = [
    viewerId ?? "anon",
    params.gameId,
    near ? lat : "",
    near ? lon : "",
    params.radius,
    params.lang,
    params.limit,
  ].join("|");

  return withCache(`home:feed:${key}`, () => api.get<HomeFeed>(endpoints.feed, query));
}
