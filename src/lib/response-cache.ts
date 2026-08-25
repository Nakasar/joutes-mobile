/**
 * Cache de secours des réponses de l'API (IndexedDB clé→valeur). Permet de
 * continuer à naviguer en cas d'erreur réseau / mode hors ligne : on tente le
 * réseau, on mémorise chaque réponse réussie, et on la ressert si un appel
 * ultérieur échoue (ou d'emblée si l'appareil est hors ligne).
 *
 * Séparé du store `offline-store` (téléchargements volumineux par jeu) : ici on
 * ne stocke que la dernière réponse de listes/détails légers.
 */

import { ApiError } from "../api/client";
import {
  isNetworkDegraded,
  reportOfflineFallback,
  staleWhileSlow,
  trackNetwork,
} from "./network-status";

const DB_NAME = "joutes-cache";
const DB_VERSION = 1;
const STORE = "responses";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const request = db
        .transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Vide entièrement le cache de secours (best-effort). À appeler lorsque le
 * contexte utilisateur change — déconnexion ou session expirée (401) — pour ne
 * jamais resservir hors ligne les données privées d'un compte précédent.
 */
export async function cacheClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(STORE).clear();
    });
  } catch {
    /* best-effort : un échec de purge ne doit rien casser */
  }
}

/**
 * Oublie une entrée précise (best-effort).
 *
 * Ce qu'on écrit peut périmer ce qu'on a lu : suivre un joueur change le
 * compteur d'abonnés de sa fiche, déjà mémorisée. Purger la seule clé
 * concernée évite d'attendre l'expiration — il n'y en a pas — sans jeter le
 * reste du cache comme le ferait `cacheClear`.
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(STORE).delete(key);
    });
  } catch {
    /* best-effort : un échec de purge ne doit rien casser */
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      tx.objectStore(STORE).put(value, key);
    });
  } catch {
    /* le cache est best-effort : un échec d'écriture ne doit rien casser */
  }
}

/**
 * Exécute `fetcher` en s'appuyant sur le cache :
 * - hors ligne, on sert directement la dernière réponse mémorisée si elle
 *   existe ;
 * - si le réseau met trop longtemps à répondre, on sert la dernière réponse
 *   mémorisée **sans annuler la requête** : quand elle aboutit, elle met le
 *   cache à jour et l'affichage se rafraîchit (voir `network-status`) ;
 * - sinon on attend le réseau (et on met le cache à jour), avec repli sur la
 *   dernière réponse en cas d'échec.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  if (isOffline) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
  }

  const request = trackNetwork(fetcher());
  // Le cache est alimenté même lorsque la réponse arrive après qu'on a servi la
  // version mémorisée : c'est elle qui sera relue au rechargement.
  void request.then(
    (result) => cacheSet(key, result),
    () => {},
  );

  // Réseau déjà jugé inexploitable : on sert la dernière réponse connue sans
  // refaire patienter, la requête en fond constatera son retour.
  if (isNetworkDegraded()) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
  }

  const stale = await staleWhileSlow(request, () => cacheGet<T>(key));
  if (stale !== null) return stale;

  try {
    return await request;
  } catch (error) {
    // On ne se rabat sur le cache que pour les erreurs réseau (statut 0 dans ce
    // client). Une erreur HTTP légitime (401 session expirée, 403, 404…) doit
    // remonter telle quelle, sans resservir de données potentiellement privées
    // ou obsolètes.
    if (error instanceof ApiError && error.status === 0) {
      const cached = await cacheGet<T>(key);
      if (cached !== null) {
        reportOfflineFallback();
        return cached;
      }
    }
    throw error;
  }
}
