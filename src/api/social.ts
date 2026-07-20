import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  FriendRequest,
  LairsListResponse,
  PlayGroup,
  PublicUser,
} from "./types";

/** Amis du compte connecté (nécessite une session). */
export function listFriends(): Promise<PublicUser[]> {
  return api
    .get<{ friends: PublicUser[] }>(endpoints.friends.list)
    .then((r) => r.friends ?? []);
}

/** Demandes d'ami entrantes en attente. */
export function listFriendRequests(): Promise<FriendRequest[]> {
  return api
    .get<{ requests: FriendRequest[] }>(endpoints.friends.requests)
    .then((r) => r.requests ?? []);
}

/** Groupes de jeu du compte connecté. */
export function listPlayGroups(): Promise<PlayGroup[]> {
  return api
    .get<{ groups: PlayGroup[] }>(endpoints.playGroups.list)
    .then((r) => r.groups ?? []);
}

/** Boutiques / lieux (lairs) — annuaire public. */
export function listLairs(): Promise<LairsListResponse> {
  return api.get<LairsListResponse>(endpoints.lairs.list, { limit: 30 });
}
