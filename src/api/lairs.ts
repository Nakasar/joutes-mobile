import { api } from "./client";
import { endpoints } from "./endpoints";
import type { LairDetail, LairsListResponse } from "./types";
import { cacheDelete, withCache } from "../lib/response-cache";

/**
 * L'annuaire sans filtre, tel que l'onglet « Lieux » l'ouvre.
 *
 * `withCache` sous une clé fixe : la demande ne varie pas, et c'est ce qui
 * permet de rouvrir l'onglet hors ligne. Vivait dans `social.ts`, d'où le nom
 * de sa clé — la changer ferait repartir de zéro les caches déjà installés,
 * pour rien.
 */
export function listLairs(): Promise<LairsListResponse> {
  return withCache("social:lairs", () =>
    api.get<LairsListResponse>(endpoints.lairs.list, { limit: 30 }),
  );
}

/** Ce que rend l'annuaire quand on lui demande de chercher autour d'un point. */
export interface LairSearch {
  search?: string;
  gameId?: string;
  /** Latitude et longitude vont ensemble : une seule ne désigne aucun point. */
  lat?: number;
  lng?: number;
  /** Rayon en kilomètres. Ignoré sans les deux coordonnées. */
  radius?: number;
  page?: number;
  limit?: number;
}

/**
 * L'annuaire des lieux.
 *
 * **Sans cache** : la recherche et la position font partie de la demande, et
 * mémoriser une liste sous une clé qui les ignorerait rendrait les résultats
 * d'un autre quartier. L'annuaire sans filtre, lui, reste servi par
 * `listLairs`, qui n'a pas ce problème.
 */
export function searchLairs(params: LairSearch = {}): Promise<LairsListResponse> {
  const { lat, lng, radius, ...rest } = params;
  const near = lat !== undefined && lng !== undefined;

  return api.get<LairsListResponse>(endpoints.lairs.list, {
    ...rest,
    ...(near ? { lat, lng, ...(radius !== undefined ? { radius } : {}) } : {}),
  });
}

/**
 * La fiche d'un lieu.
 *
 * `withCache` : une vitrine change au rythme des annonces de son gérant, et la
 * relire à chaque ouverture ferait payer un aller-retour à un simple retour en
 * arrière. Le suivi la purge, seule écriture qui la modifie depuis le mobile.
 */
export function getLair(lairId: string): Promise<LairDetail> {
  return withCache(`lairs:detail:${lairId}`, () =>
    api.get<LairDetail>(endpoints.lairs.detail(lairId)),
  );
}

/**
 * Suivre un lieu, ou cesser de le suivre.
 *
 * Deux verbes idempotents, comme côté serveur : une bascule laisserait un
 * double toucher dans l'état contraire à celui voulu.
 *
 * La fiche mémorisée est purgée après coup : elle porte `isFollowing` et le
 * compteur, et surtout la visibilité d'un lieu privé, qui tient précisément au
 * fait de le suivre — la garder en cache après avoir cessé de le suivre la
 * montrerait encore une fois de trop.
 *
 * L'annuaire, lui, n'est pas purgé : sa requête de visibilité reconnaît les
 * lieux privés par `owners`, pas par le fait de les suivre, si bien que suivre
 * ou non n'y change rien.
 */
export async function setFollowingLair(
  lairId: string,
  following: boolean,
): Promise<{ following: boolean; followersCount: number }> {
  const path = endpoints.lairs.follow(lairId);
  const result = following
    ? await api.put<{ following: boolean; followersCount: number }>(path)
    : await api.delete<{ following: boolean; followersCount: number }>(path);

  await cacheDelete(`lairs:detail:${lairId}`);

  return result;
}
