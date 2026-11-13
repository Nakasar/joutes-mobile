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

/** Accepte une demande d'ami reçue. */
export function acceptFriendRequest(requestId: string): Promise<unknown> {
  return api.post(endpoints.friends.request(requestId), {});
}

/** Refuse une demande d'ami reçue. */
export function declineFriendRequest(requestId: string): Promise<unknown> {
  return api.delete(endpoints.friends.request(requestId));
}

/**
 * Envoie une demande d'ami à un joueur désigné par son tag `pseudo#1234`
 * (ou son nom d'utilisateur). L'autre la verra dans ses demandes.
 */
export function sendFriendRequest(username: string): Promise<unknown> {
  return api.post(endpoints.friends.list, { username });
}

/**
 * Ajoute un ami par son code ami (lu sur son QR) : l'amitié est immédiate,
 * comme sur le site — le code se montre en personne.
 */
export function addFriendByCode(code: string): Promise<{ friend: PublicUser }> {
  return api.post<{ friend: PublicUser }>(endpoints.friends.scan, { code });
}

/** Mon code ami, créé au premier appel. */
export function getMyFriendCode(): Promise<string> {
  return api.get<{ code: string }>(endpoints.friends.code).then((r) => r.code);
}
