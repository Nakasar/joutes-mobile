import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  FriendRequest,
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
