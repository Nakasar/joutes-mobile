/**
 * Stockage local des clés de synchronisation de tournoi (`tpsk_...`).
 *
 * Il n'existe pas de « liste des tournois auxquels je participe » côté API :
 * chaque joueur reçoit une clé secrète unique lors de son inscription
 * (organisateur), transmise via un lien/QR à usage unique. On la conserve
 * localement, par tournoi, puis `POST /tournaments/sync` la résout en
 * tournoi + joueur à chaque affichage de la liste (même mécanisme que le
 * client web, `lib/tournament-sync-storage.ts` côté joutes-app).
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
