import { getExportInfo } from "../api/exports";
import { getFetch } from "../api/http";
import type { GameExport, OfflineMeta } from "../api/types";
import { saveExport } from "./offline-store";

/**
 * Télécharge et stocke localement les données hors ligne d'un jeu :
 * 1. `GET /games/{slug}/exports` → URL + taille + date du document ;
 * 2. téléchargement du document JSON (règles FR/EN, cartes, erratas) ;
 * 3. écriture dans IndexedDB avec ses métadonnées.
 *
 * Lecture bufferisée (pas de dépendance au streaming de la réponse) pour rester
 * compatible avec le transport HTTP natif de Tauri sur iOS/Android.
 */
export async function downloadGameData(
  slug: string,
  name: string,
): Promise<OfflineMeta> {
  const info = await getExportInfo(slug);

  const fetch = await getFetch();
  const response = await fetch(info.url);
  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status}).`);
  }

  const text = await response.text();
  let data: GameExport;
  try {
    data = JSON.parse(text) as GameExport;
  } catch {
    throw new Error("Document d'export illisible.");
  }

  const meta: OfflineMeta = {
    slug,
    name,
    size: info.size || text.length,
    generatedAt: info.generatedAt,
    downloadedAt: new Date().toISOString(),
  };
  await saveExport(meta, data);
  return meta;
}
