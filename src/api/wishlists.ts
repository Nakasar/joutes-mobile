import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  Wishlist,
  WishlistItem,
  WishlistItemsResponse,
  WishlistVisibility,
  WishlistsMineResponse,
} from "./types";

export interface WishlistInput {
  name: string;
  description?: string;
  visibility?: WishlistVisibility;
}

export interface WishlistItemInput {
  cardId: string;
  gameSlug: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  type?: string;
  quantity?: number;
  note?: string;
}

/** Chaque liste où l'utilisateur peut ajouter une carte : ses listes perso + celles de ses groupes. */
export function listMyWishlists(): Promise<WishlistsMineResponse> {
  return api.get<WishlistsMineResponse>(endpoints.wishlists.mine);
}

/** Listes de souhaits personnelles de l'utilisateur connecté. */
export function listPersonalWishlists(): Promise<Wishlist[]> {
  return api
    .get<{ wishlists: Wishlist[] }>(endpoints.wishlists.list)
    .then((r) => r.wishlists ?? []);
}

export function createWishlist(input: WishlistInput): Promise<Wishlist> {
  return api.post<Wishlist>(endpoints.wishlists.list, input);
}

/** Listes de souhaits d'un play-group. */
export function listPlayGroupWishlists(groupId: string): Promise<Wishlist[]> {
  return api
    .get<{ wishlists: Wishlist[] }>(endpoints.playGroups.wishlists(groupId))
    .then((r) => r.wishlists ?? []);
}

export function createPlayGroupWishlist(
  groupId: string,
  input: WishlistInput,
): Promise<Wishlist> {
  return api.post<Wishlist>(endpoints.playGroups.wishlists(groupId), input);
}

export function getWishlist(
  wishlistId: string,
): Promise<{ wishlist: Wishlist; canEdit: boolean }> {
  return api.get<{ wishlist: Wishlist; canEdit: boolean }>(
    endpoints.wishlists.detail(wishlistId),
  );
}

export function updateWishlist(
  wishlistId: string,
  updates: Partial<WishlistInput>,
): Promise<Wishlist> {
  return api.patch<Wishlist>(endpoints.wishlists.detail(wishlistId), updates);
}

export function deleteWishlist(wishlistId: string): Promise<void> {
  return api.delete<void>(endpoints.wishlists.detail(wishlistId));
}

export function listWishlistItems(
  wishlistId: string,
  page = 1,
): Promise<WishlistItemsResponse> {
  return api.get<WishlistItemsResponse>(endpoints.wishlists.items(wishlistId), {
    page,
    limit: 96,
  });
}

export function addWishlistItem(
  wishlistId: string,
  input: WishlistItemInput,
): Promise<WishlistItem> {
  return api.post<WishlistItem>(endpoints.wishlists.items(wishlistId), input);
}

export function updateWishlistItem(
  wishlistId: string,
  itemId: string,
  updates: { quantity?: number; note?: string },
): Promise<WishlistItem> {
  return api.patch<WishlistItem>(
    endpoints.wishlists.item(wishlistId, itemId),
    updates,
  );
}

export function removeWishlistItem(
  wishlistId: string,
  itemId: string,
): Promise<void> {
  return api.delete<void>(endpoints.wishlists.item(wishlistId, itemId));
}
