import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  Deck,
  DeckInput,
  DeckLegendFacet,
  DeckVisibility,
  DecksListResponse,
} from "./types";
import type { DeckCardInfo } from "../lib/deck-contents";
import { cacheDelete, withCache } from "../lib/response-cache";

/**
 * Decks : les siens, la librairie publique, la fiche d'un deck et son contenu.
 *
 * Politique de cache, choisie ligne par ligne :
 * - la **fiche** d'un deck et les **cartes** qu'elle résout passent par
 *   `withCache`. Ce sont des lectures, et un deck ouvert dans une boutique sans
 *   réseau reste ce qu'on est venu y consulter ;
 * - les **listes paginées** n'en ont pas : elles s'empilent page par page dans
 *   l'état de l'écran, et une clé de cache par combinaison de filtres
 *   mélangerait les pages plus qu'elle ne servirait ;
 * - les **écritures** n'en ont pas non plus, et purgent la fiche qu'elles
 *   périment.
 *
 * Pas d'`offlineFirst` : les decks ne sont pas dans le document d'export d'un
 * jeu, qui ne porte que le catalogue, les règles et les erratas.
 */

export interface SearchDecksParams {
  /** `mine` : ses decks quelle que soit leur visibilité. `public` : la librairie. */
  scope?: "mine" | "all" | "public";
  playerId?: string;
  gameId?: string;
  /** Répétable. `unlisted` n'est accepté qu'avec `scope=mine`. */
  visibility?: DeckVisibility[];
  search?: string;
  format?: string;
  legendCardId?: string;
  /** Répétable : un deck retenu couvre tous les domaines demandés. */
  domains?: string[];
  sortBy?: "name" | "createdAt" | "updatedAt" | "favoritesCount" | "views";
  sortOrder?: "asc" | "desc";
  favoritesOnly?: boolean;
  page?: number;
  limit?: number;
}

export function searchDecks(params: SearchDecksParams): Promise<DecksListResponse> {
  const { visibility, domains, favoritesOnly, ...rest } = params;
  return api.get<DecksListResponse>(endpoints.decks.list, {
    ...rest,
    // Tableaux : le client les envoie en paramètres répétés, forme que l'API
    // relit par `getAll`. Un tableau vide n'écrit rien.
    ...(visibility?.length ? { visibility } : {}),
    ...(domains?.length ? { domain: domains } : {}),
    ...(favoritesOnly ? { favoritesOnly: "true" } : {}),
  });
}

/** La fiche d'un deck. Un deck privé d'un autre joueur répond 403. */
export function getDeck(deckId: string): Promise<Deck> {
  return withCache(`decks:detail:${deckId}`, () =>
    api.get<Deck>(endpoints.decks.detail(deckId)),
  );
}

/**
 * Les cartes d'un deck, résolues contre le catalogue de son jeu.
 *
 * Le contenu d'un deck ne porte que des identifiants : le nom, l'illustration
 * et le coût viennent du catalogue, seule source à jour d'une carte. L'API en
 * accepte 500 par appel — la taille d'un très gros deck.
 */
export function getDeckCards(
  gameSlugOrId: string,
  cardIds: string[],
): Promise<DeckCardInfo[]> {
  if (cardIds.length === 0) return Promise.resolve([]);

  const ids = cardIds.slice(0, 500);
  return withCache(`decks:cards:${gameSlugOrId}:${ids.join(",")}`, () =>
    api
      .get<{ cards: DeckCardInfo[] }>(endpoints.games.deckCards(gameSlugOrId), { id: ids })
      .then((r) => r.cards ?? []),
  );
}

/**
 * Apparie des noms de cartes au catalogue d'un jeu, pour appliquer une liste
 * collée. Les clés de la réponse sont les noms **tels qu'envoyés**, pas tels
 * que le catalogue les orthographie.
 */
export function resolveDeckCardsByName(
  gameSlugOrId: string,
  names: string[],
): Promise<Record<string, DeckCardInfo>> {
  return api
    .post<{ matches: Record<string, DeckCardInfo> }>(
      endpoints.games.deckCards(gameSlugOrId),
      { names },
    )
    .then((r) => r.matches ?? {});
}

/** Légendes réellement jouées, pour la facette de la librairie. */
export function listDeckLegends(gameId?: string): Promise<DeckLegendFacet[]> {
  return withCache(`decks:legends:${gameId ?? "all"}`, () =>
    api
      .get<{ legends: DeckLegendFacet[] }>(endpoints.decks.legends, { gameId })
      .then((r) => r.legends ?? []),
  );
}

export function createDeck(input: DeckInput): Promise<Deck> {
  return api.post<Deck>(endpoints.decks.list, input);
}

/**
 * Oublie la fiche mémorisée d'un deck.
 *
 * Toute écriture la périme, et le cache n'expire pas de lui-même : sans cette
 * purge, un deck modifié puis rouvert sur un réseau lent se rafficherait tel
 * qu'il était avant la modification.
 */
async function forgetDeck(deckId: string): Promise<void> {
  await cacheDelete(`decks:detail:${deckId}`);
}

/**
 * Modifie un deck. `PATCH` est bimodal côté API : ce service ne pose que le
 * mode « champs du deck », le favori ayant le sien juste en dessous.
 */
export async function updateDeck(
  deckId: string,
  input: Partial<DeckInput>,
): Promise<Deck> {
  const deck = await api.patch<Deck>(endpoints.decks.detail(deckId), input);
  await forgetDeck(deckId);
  return deck;
}

/** Bascule le favori de l'appelant sur un deck. */
export async function setDeckFavorite(deckId: string, favorite: boolean): Promise<Deck> {
  const deck = await api.patch<Deck>(endpoints.decks.detail(deckId), { favorite });
  await forgetDeck(deckId);
  return deck;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await api.delete<void>(endpoints.decks.detail(deckId));
  await forgetDeck(deckId);
}

/** « Copier chez moi ». La copie arrive privée, quelle que soit la source. */
export function copyDeck(deckId: string): Promise<Deck> {
  return api.post<Deck>(endpoints.decks.copy(deckId));
}
