import type { GameExport } from "../api/types";
import {
  isNetworkDegraded,
  reportOfflineFallback,
  staleWhileSlow,
  trackNetwork,
} from "./network-status";
import { loadExport } from "./offline-store";

/**
 * Exécute un appel réseau en basculant sur les données hors ligne du jeu
 * lorsque c'est nécessaire :
 * - si l'appareil est hors ligne et qu'un export local existe, on sert
 *   directement le cache ;
 * - si le réseau met trop longtemps à répondre, on sert le cache **sans
 *   annuler la requête** : quand elle aboutit, l'affichage se rafraîchit (voir
 *   `network-status`) ;
 * - sinon on attend le réseau, avec repli sur le cache en cas d'échec.
 * `offline` renvoie `null` si le cache ne peut pas satisfaire la demande
 * (on propage alors l'erreur réseau).
 */
export async function offlineFirst<T>(
  slug: string,
  network: () => Promise<T>,
  offline: (exp: GameExport) => T | null,
): Promise<T> {
  const loadStale = async (): Promise<T | null> => {
    const exp = await loadExport(slug);
    return exp ? offline(exp) : null;
  };

  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  if (isOffline) {
    const stale = await loadStale();
    if (stale !== null) return stale;
  }

  const request = trackNetwork(network());

  // Réseau déjà jugé inexploitable : inutile de refaire patienter trois
  // secondes à chaque écran, on sert le cache tout de suite. La requête part
  // quand même, et c'est elle qui constatera le retour du réseau.
  if (isNetworkDegraded()) {
    const stale = await loadStale();
    if (stale !== null) return stale;
  }

  const stale = await staleWhileSlow(request, loadStale);
  if (stale !== null) return stale;

  try {
    return await request;
  } catch (error) {
    const fallback = await loadStale();
    if (fallback !== null) {
      reportOfflineFallback();
      return fallback;
    }
    throw error;
  }
}
