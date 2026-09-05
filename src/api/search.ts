import { api } from "./client";
import { endpoints } from "./endpoints";
import type { SearchResponse } from "./types";

/**
 * La recherche globale — `GET /search`.
 *
 * **Sans cache** : la question fait toute la réponse, et l'écran ne relance
 * pas deux fois la même frappe. Une question de moins de deux caractères ne
 * part pas : l'API répondrait cinq listes vides, autant se les épargner.
 */
export async function searchAll(query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length < 2) return EMPTY;
  return api.get<SearchResponse>(endpoints.search, { q });
}

export const EMPTY: SearchResponse = { games: [], cards: [], lairs: [], events: [], rules: [] };
