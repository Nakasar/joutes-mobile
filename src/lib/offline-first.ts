import type { GameExport } from "../api/types";
import { loadExport } from "./offline-store";

/**
 * Exécute un appel réseau en basculant sur les données hors ligne du jeu
 * lorsque c'est nécessaire :
 * - si l'appareil est hors ligne et qu'un export local existe, on sert
 *   directement le cache ;
 * - sinon on tente le réseau, avec repli sur le cache en cas d'échec.
 * `offline` renvoie `null` si le cache ne peut pas satisfaire la demande
 * (on propage alors l'erreur réseau).
 */
export async function offlineFirst<T>(
  slug: string,
  network: () => Promise<T>,
  offline: (exp: GameExport) => T | null,
): Promise<T> {
  const isOffline =
    typeof navigator !== "undefined" && navigator.onLine === false;

  if (isOffline) {
    const exp = await loadExport(slug);
    if (exp) {
      const result = offline(exp);
      if (result !== null) return result;
    }
  }

  try {
    return await network();
  } catch (error) {
    const exp = await loadExport(slug);
    if (exp) {
      const result = offline(exp);
      if (result !== null) return result;
    }
    throw error;
  }
}
