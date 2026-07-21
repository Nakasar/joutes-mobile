import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CardDetail, CardsSearchResponse, GameSet } from "./types";
import { offlineGetCard, offlineSearchCards } from "../lib/offline-adapters";
import { offlineFirst } from "../lib/offline-first";

export interface SearchCardsParams {
  searchQuery?: string;
  setCode?: string;
  type?: string;
  lang?: string;
  page?: number;
  limit?: number;
}

/** Recherche dans le catalogue de cartes d'un jeu (Meilisearch, ou cache hors ligne). */
export function searchCards(
  gameIdOrSlug: string,
  params: SearchCardsParams = {},
): Promise<CardsSearchResponse> {
  return offlineFirst(
    gameIdOrSlug,
    () =>
      api.get<CardsSearchResponse>(endpoints.games.cards(gameIdOrSlug), {
        ...params,
      }),
    (exp) => offlineSearchCards(exp, params),
  );
}

/** Détail d'une carte, avec ses erratas / clarifications / rulings. */
export function getCard(
  gameIdOrSlug: string,
  cardId: string,
): Promise<CardDetail> {
  return offlineFirst(
    gameIdOrSlug,
    () => api.get<CardDetail>(endpoints.games.card(gameIdOrSlug, cardId)),
    (exp) => offlineGetCard(exp, cardId),
  );
}

export function listSets(gameIdOrSlug: string): Promise<GameSet[]> {
  return api.get<GameSet[]>(endpoints.games.sets(gameIdOrSlug));
}
