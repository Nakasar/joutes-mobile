import { getExportInfo } from "../api/exports";
import { getFetch } from "../api/http";
import type { GameExport, OfflineMeta } from "../api/types";
import { saveExport } from "./offline-store";

export interface DownloadProgress {
  /** Octets reçus. */
  loaded: number;
  /** Taille totale attendue (octets). */
  total: number;
}

/**
 * Télécharge et stocke localement les données hors ligne d'un jeu :
 * 1. `GET /games/{slug}/exports` → URL + taille + date du document ;
 * 2. téléchargement du document JSON (règles FR/EN, cartes, erratas) ;
 * 3. écriture dans IndexedDB avec ses métadonnées.
 * `onProgress` est appelé au fil du téléchargement quand le flux le permet.
 */
export async function downloadGameData(
  slug: string,
  name: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<OfflineMeta> {
  const info = await getExportInfo(slug);
  const fetch = await getFetch();
  const response = await fetch(info.url);
  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status}).`);
  }

  const total = info.size || Number(response.headers.get("content-length")) || 0;
  let data: GameExport;

  // Lecture en flux pour rapporter la progression quand c'est possible ;
  // repli sur une lecture simple sinon (ex. transport natif Tauri).
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        onProgress?.({ loaded, total });
      }
    }
    const merged = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    data = JSON.parse(new TextDecoder().decode(merged)) as GameExport;
  } else {
    const text = await response.text();
    onProgress?.({ loaded: total || text.length, total: total || text.length });
    data = JSON.parse(text) as GameExport;
  }

  const meta: OfflineMeta = {
    slug,
    name,
    size: info.size || total,
    generatedAt: info.generatedAt,
    downloadedAt: new Date().toISOString(),
  };
  await saveExport(meta, data);
  return meta;
}
