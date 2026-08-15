import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  CollectionCardInput,
  CollectionOverview,
  CollectionValue,
  CollectionValueTotal,
  GameCollectionResult,
  OwnedCopiesResponse,
} from "./types";
import { withCache } from "../lib/response-cache";

export function getCollectionOverview(
  includeEmpty = false,
): Promise<CollectionOverview> {
  return withCache(`collection:overview:${includeEmpty}`, () =>
    api.get<CollectionOverview>(endpoints.collection.overview, {
      includeEmpty,
    }),
  );
}

export function getPlayGroupCollectionOverview(
  playGroupId: string,
): Promise<CollectionOverview> {
  return withCache(`collection:group-overview:${playGroupId}`, () =>
    api.get<CollectionOverview>(
      endpoints.playGroups.collection.overview(playGroupId),
    ),
  );
}

export interface GameCollectionParams {
  page?: number;
  limit?: number;
  search?: string;
  setCode?: string;
  type?: string;
  /** true = uniquement les cartes possédées, false = uniquement les manquantes, undefined = toutes. */
  owned?: boolean;
}

/**
 * Catalogue paginé d'un jeu, chaque carte annotée de la quantité possédée.
 * Non mis en cache : cet écran permet de modifier la collection, on veut
 * toujours la donnée la plus fraîche possible quand le réseau est disponible.
 */
export function getGameCollection(
  gameSlug: string,
  params: GameCollectionParams = {},
  playGroupId?: string,
): Promise<GameCollectionResult> {
  const path = playGroupId
    ? endpoints.playGroups.collection.game(playGroupId, gameSlug)
    : endpoints.collection.game(gameSlug);
  return api.get<GameCollectionResult>(path, {
    page: params.page,
    limit: params.limit,
    search: params.search,
    setCode: params.setCode,
    type: params.type,
    owned: params.owned,
  });
}

/**
 * Demande le recalcul de la valeur estimée de toute la collection (personnelle,
 * ou celle d'un groupe de jeu).
 *
 * Le serveur réestime chaque jeu au prix du moment et enregistre le résultat :
 * la valeur ne bouge qu'ici, ce qui la rend comparable d'une fois sur l'autre.
 * `value` est nul quand il n'y a plus rien à estimer.
 */
export function recomputeCollectionValue(
  playGroupId?: string,
): Promise<{ values: Record<string, CollectionValue>; value: CollectionValueTotal | null }> {
  const path = playGroupId
    ? endpoints.playGroups.collection.value(playGroupId)
    : endpoints.collection.value;
  return api.post(path, {});
}

/** Le même recalcul, pour un seul jeu. */
export function recomputeGameCollectionValue(
  gameSlug: string,
  playGroupId?: string,
): Promise<{ value: CollectionValue }> {
  const path = playGroupId
    ? endpoints.playGroups.collection.gameValue(playGroupId, gameSlug)
    : endpoints.collection.gameValue(gameSlug);
  return api.post(path, {});
}

/** Ajoute un exemplaire à la collection (personnelle, ou d'un play-group si `playGroupId` est fourni). */
export function addCollectionCard(
  card: CollectionCardInput,
  playGroupId?: string,
): Promise<{ id: string }> {
  const path = playGroupId
    ? endpoints.playGroups.collection.cards(playGroupId)
    : endpoints.collection.cards;
  return api.post<{ id: string }>(path, card);
}

/** Retire un exemplaire quelconque de la carte `cardId` de la collection. */
export function removeCollectionCard(
  cardId: string,
  playGroupId?: string,
): Promise<{ success: true }> {
  const path = playGroupId
    ? endpoints.playGroups.collection.card(playGroupId, cardId)
    : endpoints.collection.card(cardId);
  return api.delete<{ success: true }>(path);
}

/** Copies possédées d'une carte du catalogue (pour la mettre en vente). */
export function getOwnedCopies(cardId: string): Promise<OwnedCopiesResponse> {
  return api.get<OwnedCopiesResponse>(endpoints.collection.card(cardId));
}
