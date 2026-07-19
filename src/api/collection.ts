import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CollectionOverview, GameCollectionStats } from "./types";

export function getCollectionOverview(
  includeEmpty = false,
): Promise<CollectionOverview> {
  return api.get<CollectionOverview>(endpoints.collection.overview, {
    includeEmpty,
  });
}

export function getGameCollection(
  gameSlug: string,
): Promise<GameCollectionStats> {
  return api.get<GameCollectionStats>(endpoints.collection.game(gameSlug));
}
