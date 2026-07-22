import { api } from "./client";
import { endpoints } from "./endpoints";
import type { PublicUserProfile, SellList, Wishlist } from "./types";
import { withCache } from "../lib/response-cache";

/** Profil public d'un utilisateur (soi-même ou un autre). */
export function getUserProfile(
  userTagOrId: string,
): Promise<PublicUserProfile> {
  return withCache(`users:profile:${userTagOrId}`, () =>
    api.get<PublicUserProfile>(endpoints.users.detail(userTagOrId)),
  );
}

/** Listes de souhaits publiques de cet utilisateur. */
export function getUserPublicWishlists(
  userTagOrId: string,
): Promise<Wishlist[]> {
  return withCache(`users:wishlists:${userTagOrId}`, () =>
    api
      .get<{ wishlists: Wishlist[] }>(endpoints.users.wishlists(userTagOrId))
      .then((r) => r.wishlists ?? []),
  );
}

/** Liste de vente de cet utilisateur (toujours publique), ou `null`. */
export function getUserSellList(
  userTagOrId: string,
): Promise<SellList | null> {
  return withCache(`users:sellList:${userTagOrId}`, () =>
    api
      .get<{ sellList: SellList | null }>(endpoints.users.sellList(userTagOrId))
      .then((r) => r.sellList),
  );
}
