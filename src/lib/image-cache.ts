import { getFetch } from "../api/http";

/**
 * Cache local des images (icônes de jeux, bannières d'actualités) pour un
 * affichage hors ligne. On stocke les octets (ArrayBuffer + type MIME) plutôt
 * qu'un Blob directement, pour rester compatible avec IndexedDB de WKWebView
 * (iOS). Les images sont servies depuis le domaine blob déjà autorisé par le
 * plugin HTTP de Tauri.
 */

interface ImageRecord {
  buffer: ArrayBuffer;
  type: string;
}

const DB_NAME = "joutes-images";
const DB_VERSION = 1;
const STORE = "images";

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

function getRecord(url: string): Promise<ImageRecord | null> {
  return openDb()
    .then(
      (db) =>
        new Promise<ImageRecord | null>((resolve, reject) => {
          const request = db
            .transaction(STORE, "readonly")
            .objectStore(STORE)
            .get(url);
          request.onsuccess = () =>
            resolve((request.result as ImageRecord) ?? null);
          request.onerror = () => reject(request.error);
        }),
    )
    .catch(() => null);
}

function putRecord(url: string, record: ImageRecord): Promise<void> {
  return openDb()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
          tx.objectStore(STORE).put(record, url);
        }),
    )
    .catch(() => {
      /* best-effort */
    });
}

function toObjectUrl(record: ImageRecord): string {
  return URL.createObjectURL(new Blob([record.buffer], { type: record.type }));
}

/** Object URL depuis le cache si l'image y est déjà, sinon `null`. */
export async function getCachedImageUrl(url: string): Promise<string | null> {
  const record = await getRecord(url);
  return record ? toObjectUrl(record) : null;
}

/**
 * Télécharge et met en cache une image (best-effort, sans object URL) pour un
 * affichage hors ligne ultérieur. N'échoue jamais bruyamment.
 */
export async function prefetchImage(url: string): Promise<void> {
  try {
    if (await getRecord(url)) return; // déjà en cache
    const fetch = await getFetch();
    const response = await fetch(url);
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    const type = response.headers.get("content-type") || "image/*";
    await putRecord(url, { buffer, type });
  } catch {
    /* best-effort */
  }
}
