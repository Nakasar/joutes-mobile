import { api } from "./client";
import { endpoints } from "./endpoints";
import type { DeckCheckResponse } from "./types";

/**
 * Valide / parse une liste de deck Riftbound. `deckList` accepte une URL de
 * deck Piltover Archive, un code de deck Piltover, ou une liste collée brute.
 */
export function checkDeck(
  gameIdOrSlug: string,
  deckList: string,
): Promise<DeckCheckResponse> {
  return api.post<DeckCheckResponse>(endpoints.games.deckChecker(gameIdOrSlug), {
    deckList,
  });
}
