/**
 * Persistance clé/valeur : plugin Store de Tauri quand l'app tourne dans
 * Tauri (fichier chiffrable côté natif, survit aux mises à jour de la
 * webview), sinon localStorage en développement navigateur.
 */

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORE_FILE = "joutes.json";

export async function storageGet(key: string): Promise<string | null> {
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE, { autoSave: true });
    return (await store.get<string>(key)) ?? null;
  }
  return localStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE, { autoSave: true });
    await store.set(key, value);
    return;
  }
  localStorage.setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE, { autoSave: true });
    await store.delete(key);
    return;
  }
  localStorage.removeItem(key);
}
