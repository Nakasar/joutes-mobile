import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  LeaderboardResponse,
  MyPermissions,
  PublicUserProfile,
  RegistryResponse,
  RegistrySort,
  SellList,
  UserAchievementsResponse,
  UserContent,
  Wishlist,
} from "./types";
import { cacheDelete, withCache } from "../lib/response-cache";

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

/** Jeux suivis par l'utilisateur connecté (session requise). */
export function getMyFollowedGameIds(): Promise<string[]> {
  return api
    .get<{ gameIds: string[] }>(endpoints.users.myGames)
    .then((r) => r.gameIds ?? []);
}

/** Permissions effectives du compte connecté (session requise). */
export function getMyPermissions(): Promise<MyPermissions> {
  return api.get<MyPermissions>(endpoints.users.myPermissions);
}

/**
 * Oublie la fiche mémorisée d'un profil.
 *
 * Suivre un joueur change son compteur d'abonnés et le « est-ce que je le
 * suis » de sa fiche, déjà en cache. La clé dépend de la façon dont on est
 * arrivé sur le profil — par tag ou par identifiant : on purge donc les deux
 * formes, faute de savoir laquelle a été lue.
 */
async function forgetProfile(userTagOrId: string, userId?: string): Promise<void> {
  await cacheDelete(`users:profile:${userTagOrId}`);
  if (userId && userId !== userTagOrId) {
    await cacheDelete(`users:profile:${userId}`);
  }
}

/**
 * Suivre un joueur, ou cesser de le suivre.
 *
 * Deux verbes plutôt qu'une bascule, comme côté serveur : répéter la demande ne
 * change rien, et deux envois partis d'un double toucher ne peuvent pas laisser
 * l'abonnement dans l'état contraire à celui qu'on voulait.
 *
 * Sans cache — c'est une écriture — et la fiche du profil est purgée après
 * coup, sans quoi elle continuerait d'annoncer l'ancien compteur.
 */
export async function setFollowingUser(
  userTagOrId: string,
  following: boolean,
  userId?: string,
): Promise<{ following: boolean; followersCount: number }> {
  const path = endpoints.users.follow(userTagOrId);
  const result = following
    ? await api.put<{ following: boolean; followersCount: number }>(path)
    : await api.delete<{ following: boolean; followersCount: number }>(path);

  await forgetProfile(userTagOrId, userId);

  return result;
}

/**
 * Tous les succès d'un joueur, décrochés ou non.
 *
 * Une route à part de la fiche : le catalogue entier peut faire des centaines
 * d'entrées, et l'en-tête d'un profil n'a pas à le payer à chaque ouverture.
 * Un profil privé rend une liste vide.
 */
export function getUserAchievements(
  userTagOrId: string,
): Promise<UserAchievementsResponse> {
  return withCache(`users:achievements:${userTagOrId}`, () =>
    api.get<UserAchievementsResponse>(endpoints.users.achievements(userTagOrId)),
  );
}

/** Ce qu'un joueur publie : articles, vidéos, replays. */
export function getUserContents(userTagOrId: string): Promise<UserContent[]> {
  return withCache(`users:contents:${userTagOrId}`, () =>
    api
      .get<{ contents: UserContent[] }>(endpoints.users.contents(userTagOrId))
      .then((r) => r.contents ?? []),
  );
}

export interface SearchPlayersParams {
  q?: string;
  gameId?: string;
  city?: string;
  sells?: boolean;
  live?: boolean;
  sort?: RegistrySort;
  /**
   * **Compteur cumulé, pas un numéro de page.** Il monte de vingt en vingt
   * jusqu'à cent, et chaque appel rend la liste depuis le début : c'est ce que
   * fait « charger plus », et la pagination du registre n'a jamais été autre
   * chose.
   */
  count?: number;
}

/**
 * Le registre de la communauté.
 *
 * Sans cache : la liste dépend de filtres qui changent à chaque frappe, et le
 * « est-ce que je le suis » de chaque fiche se périmerait aussitôt.
 */
export function searchPlayers(params: SearchPlayersParams = {}): Promise<RegistryResponse> {
  const { q, gameId, city, sells, live, sort, count } = params;

  return api.get<RegistryResponse>(endpoints.users.list, {
    q: q || undefined,
    game: gameId,
    city,
    // Le serveur lit ces deux-là en « 1 », pas en booléen : c'est la forme que
    // porte l'URL du web, et un lien partagé doit ouvrir les mêmes résultats.
    sells: sells ? "1" : undefined,
    live: live ? "1" : undefined,
    sort,
    count,
  });
}

/** Le classement des succès, et le rang de l'appelant. */
export function getLeaderboard(): Promise<LeaderboardResponse> {
  return withCache("users:leaderboard", () =>
    api.get<LeaderboardResponse>(endpoints.users.leaderboard),
  );
}
