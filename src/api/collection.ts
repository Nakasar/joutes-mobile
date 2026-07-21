import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CollectionOverview, GameCollectionStats } from "./types";
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

export function getGameCollection(
  gameSlug: string,
): Promise<GameCollectionStats> {
  return withCache(`collection:game:${gameSlug}`, () =>
    api.get<GameCollectionStats>(endpoints.collection.game(gameSlug)),
  );
}
