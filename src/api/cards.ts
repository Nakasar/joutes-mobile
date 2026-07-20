import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CardDetail, CardsSearchResponse, GameSet } from "./types";

export interface SearchCardsParams {
  searchQuery?: string;
  setCode?: string;
  type?: string;
  lang?: string;
  page?: number;
  limit?: number;
}

/** Recherche dans le catalogue de cartes d'un jeu (Meilisearch). */
export function searchCards(
  gameIdOrSlug: string,
  params: SearchCardsParams = {},
): Promise<CardsSearchResponse> {
  return api.get<CardsSearchResponse>(endpoints.games.cards(gameIdOrSlug), {
    ...params,
  });
}

/** Détail d'une carte, avec ses erratas / clarifications / rulings. */
export function getCard(
  gameIdOrSlug: string,
  cardId: string,
): Promise<CardDetail> {
  return api.get<CardDetail>(endpoints.games.card(gameIdOrSlug, cardId));
}

export function listSets(gameIdOrSlug: string): Promise<GameSet[]> {
  return api.get<GameSet[]>(endpoints.games.sets(gameIdOrSlug));
}
