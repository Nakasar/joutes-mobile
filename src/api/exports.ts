import { api } from "./client";
import { endpoints } from "./endpoints";
import type { GameExportInfo } from "./types";

/**
 * Pointeur vers le document d'export hors ligne d'un jeu (URL + taille + date
 * de génération). Le document lui-même est un JSON volumineux hébergé hors de
 * l'API — voir `offline-download.ts` pour son téléchargement.
 */
export function getExportInfo(gameIdOrSlug: string): Promise<GameExportInfo> {
  return api.get<GameExportInfo>(endpoints.games.exports(gameIdOrSlug));
}
