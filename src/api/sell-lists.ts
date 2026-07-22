import { api } from "./client";
import { endpoints } from "./endpoints";
import type { SellList, SellListItem, SellListItemsResponse } from "./types";

export interface SellListItemInput {
  collectionEntryId: string;
  gameSlug: string;
  price?: number;
  currency?: string;
  note?: string;
}

/** La liste de vente personnelle de l'utilisateur connecté, ou `null` s'il n'a rien mis en vente. */
export function getMySellList(): Promise<SellList | null> {
  return api
    .get<{ sellList: SellList | null }>(endpoints.sellLists.mine)
    .then((r) => r.sellList);
}

/** La liste de vente d'un play-group, ou `null` si aucune n'existe encore. */
export function getPlayGroupSellList(
  groupId: string,
): Promise<{ sellList: SellList | null; canEdit: boolean }> {
  return api.get<{ sellList: SellList | null; canEdit: boolean }>(
    endpoints.playGroups.sellList(groupId),
  );
}

export function getSellList(
  sellListId: string,
): Promise<{ sellList: SellList; canEdit: boolean }> {
  return api.get<{ sellList: SellList; canEdit: boolean }>(
    endpoints.sellLists.detail(sellListId),
  );
}

export function listSellListItems(
  sellListId: string,
  page = 1,
): Promise<SellListItemsResponse> {
  return api.get<SellListItemsResponse>(
    endpoints.sellLists.items(sellListId),
    { page, limit: 96 },
  );
}

/** Met en vente une des copies possédées par l'utilisateur connecté (crée sa liste au besoin). */
export function addMySellListItem(
  input: SellListItemInput,
): Promise<SellListItem> {
  return api.post<SellListItem>(endpoints.sellLists.mineItems, input);
}

/** Met en vente une carte de la collection partagée d'un play-group (crée sa liste au besoin). */
export function addPlayGroupSellListItem(
  groupId: string,
  input: SellListItemInput,
): Promise<SellListItem> {
  return api.post<SellListItem>(
    endpoints.playGroups.sellListItems(groupId),
    input,
  );
}

export function updateSellListItem(
  sellListId: string,
  itemId: string,
  updates: { price?: number | null; currency?: string; note?: string },
): Promise<SellListItem> {
  return api.patch<SellListItem>(
    endpoints.sellLists.item(sellListId, itemId),
    updates,
  );
}

export function removeSellListItem(
  sellListId: string,
  itemId: string,
): Promise<void> {
  return api.delete<void>(endpoints.sellLists.item(sellListId, itemId));
}
