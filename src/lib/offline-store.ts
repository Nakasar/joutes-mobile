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
    // Une mise à niveau bloquée par une autre connexion ne doit pas rester
    // en suspens indéfiniment.
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Base hors ligne bloquée par une autre fenêtre."));
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      // Ne pas mémoriser une promesse rejetée : sinon toute opération future
      // échouerait sans possibilité de réessayer.
      dbPromise = null;
      reject(request.error);
    };
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

/** Écriture atomique sur les deux magasins (résolue à `oncomplete`). */
function writeBoth(
  run: (exportStore: IDBObjectStore, metaStore: IDBObjectStore) => void,
): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          [STORE_EXPORT, STORE_META],
          "readwrite",
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        run(
          transaction.objectStore(STORE_EXPORT),
          transaction.objectStore(STORE_META),
        );
      }),
  );
}

/** Enregistre un export complet + ses métadonnées (transaction atomique). */
export async function saveExport(
  meta: OfflineMeta,
  data: GameExport,
): Promise<void> {
  await writeBoth((exportStore, metaStore) => {
    exportStore.put(data, meta.slug);
    metaStore.put(meta, meta.slug);
  });
  // Cache mémoire mis à jour seulement après confirmation de l'écriture.
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

/** Supprime les données hors ligne d'un jeu (transaction atomique). */
export async function deleteExport(slug: string): Promise<void> {
  await writeBoth((exportStore, metaStore) => {
    exportStore.delete(slug);
    metaStore.delete(slug);
  });
  exportCache.delete(slug);
}

/** Y a-t-il des données hors ligne pour ce jeu ? (léger, via les métadonnées) */
export async function hasOffline(slug: string): Promise<boolean> {
  return (await getMeta(slug)) !== null;
}
