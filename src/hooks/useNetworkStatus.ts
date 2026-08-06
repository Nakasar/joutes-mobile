import { useSyncExternalStore } from "react";
import {
  getNetworkSnapshot,
  subscribeNetworkStatus,
  type NetworkSnapshot,
} from "../lib/network-status";

/**
 * État de connexion ressenti de l'app : `degraded` quand une requête a basculé
 * sur le contenu hors ligne, et `generation` qui change au retour du réseau.
 */
export function useNetworkStatus(): NetworkSnapshot {
  return useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkSnapshot,
    getNetworkSnapshot,
  );
}
