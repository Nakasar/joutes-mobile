import type { GameExport, OfflineMeta } from "../api/types";

/**
 * Stockage local des données hors ligne (IndexedDB). Deux magasins :
 * - `exports` : le document d'export complet par slug (volumineux) ;
 * - `meta`    : les métadonnées légères par slug (taille, dates), pour lister
 *   rapidement les jeux téléchargés sans charger les gros documents.
 * Un cache mémoire évite de relire le document à chaque accès offline.
 */

const DB_NAME = "joutes-offline";
const DB_VERSION = 1;
const STORE_EXPORT = "exports";
const STORE_META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;
const exportCache = new Map<string, GameExport>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_EXPORT)) {
        db.createObjectStore(STORE_EXPORT);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Enregistre un export complet + ses métadonnées. */
export async function saveExport(
  meta: OfflineMeta,
  data: GameExport,
): Promise<void> {
  await tx(STORE_EXPORT, "readwrite", (s) => s.put(data, meta.slug));
  await tx(STORE_META, "readwrite", (s) => s.put(meta, meta.slug));
  exportCache.set(meta.slug, data);
}

/** Charge le document d'export d'un jeu (depuis le cache mémoire si possible). */
export async function loadExport(slug: string): Promise<GameExport | null> {
  const cached = exportCache.get(slug);
  if (cached) return cached;
  const data = await tx<GameExport | undefined>(STORE_EXPORT, "readonly", (s) =>
    s.get(slug),
  );
  if (data) exportCache.set(slug, data);
  return data ?? null;
}

/** Métadonnées d'un jeu téléchargé (ou null). */
export function getMeta(slug: string): Promise<OfflineMeta | null> {
  return tx<OfflineMeta | undefined>(STORE_META, "readonly", (s) =>
    s.get(slug),
  ).then((m) => m ?? null);
}

/** Toutes les métadonnées des jeux téléchargés. */
export function listMeta(): Promise<OfflineMeta[]> {
  return tx<OfflineMeta[]>(STORE_META, "readonly", (s) => s.getAll());
}

/** Supprime les données hors ligne d'un jeu. */
export async function deleteExport(slug: string): Promise<void> {
  await tx(STORE_EXPORT, "readwrite", (s) => s.delete(slug));
  await tx(STORE_META, "readwrite", (s) => s.delete(slug));
  exportCache.delete(slug);
}

/** Y a-t-il des données hors ligne pour ce jeu ? (léger, via les métadonnées) */
export async function hasOffline(slug: string): Promise<boolean> {
  return (await getMeta(slug)) !== null;
}
