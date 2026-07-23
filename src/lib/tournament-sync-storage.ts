/**
 * Stockage local des clés de synchronisation des tournois rejoints en tant
 * qu'invité (`tpsk_...`), par tournoi.
 *
 * Un compte connecté n'a besoin d'aucun secret : `GET /tournaments/playing`
 * liste ses tournois côté serveur. Ce stockage ne sert que pour les joueurs
 * invités (sans compte), qui reçoivent une clé secrète à l'inscription
 * (`POST /tournaments/join` sans session) — même mécanisme que le client web
 * (`lib/tournament-sync-storage.ts` côté joutes-app).
 */

const STORAGE_KEY = "joutes-tournament-sync-keys";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAll(entries: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* stockage best-effort */
  }
}

export function getSyncKeys(): Record<string, string> {
  return readAll();
}

export function getSyncKey(tournamentId: string): string | undefined {
  return readAll()[tournamentId];
}

export function storeSyncKey(tournamentId: string, key: string): void {
  const entries = readAll();
  entries[tournamentId] = key;
  writeAll(entries);
}

export function removeSyncKey(tournamentId: string): void {
  const entries = readAll();
  delete entries[tournamentId];
  writeAll(entries);
}
