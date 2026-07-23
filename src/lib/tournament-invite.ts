/**
 * Extrait la clé de synchronisation (`tpsk_...`) d'une invitation de tournoi
 * saisie par l'utilisateur : soit le lien complet généré par l'organisateur
 * (`.../tournaments/join?tournamentId=...&key=tpsk_...`, décodé depuis un QR
 * ou collé tel quel), soit la clé seule.
 */
export function parseInviteInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const key = url.searchParams.get("key");
    if (key) return key;
  } catch {
    // Pas une URL : on considère l'entrée comme la clé elle-même.
  }

  return trimmed.startsWith("tpsk_") ? trimmed : null;
}
