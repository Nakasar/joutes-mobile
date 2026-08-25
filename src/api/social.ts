import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  FriendRequest,
  PlayGroup,
  PublicUser,
} from "./types";
import { withCache } from "../lib/response-cache";

/** Amis du compte connecté (nécessite une session). */
export function listFriends(): Promise<PublicUser[]> {
  return withCache("social:friends", () =>
    api
      .get<{ friends: PublicUser[] }>(endpoints.friends.list)
      .then((r) => r.friends ?? []),
  );
}

/** Demandes d'ami entrantes en attente. */
export function listFriendRequests(): Promise<FriendRequest[]> {
  return withCache("social:requests", () =>
    api
      .get<{ requests: FriendRequest[] }>(endpoints.friends.requests)
      .then((r) => r.requests ?? []),
  );
}

/** Groupes de jeu du compte connecté. */
export function listPlayGroups(): Promise<PlayGroup[]> {
  return withCache("social:groups", () =>
    api
      .get<{ groups: PlayGroup[] }>(endpoints.playGroups.list)
      .then((r) => r.groups ?? []),
  );
}

/** Détail d'un groupe de jeu (membres inclus), pour les membres du groupe uniquement. */
export function getPlayGroup(playGroupId: string): Promise<PlayGroup> {
  return withCache(`social:group:${playGroupId}`, () =>
    api
      .get<{ group: PlayGroup }>(endpoints.playGroups.detail(playGroupId))
      .then((r) => r.group),
  );
}
