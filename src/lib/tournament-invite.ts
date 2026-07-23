/**
 * Extrait le code public d'un tournoi (9 caractères A-Z0-9, cf.
 * `joinTournamentSchema` côté API) d'une invitation saisie par l'utilisateur :
 * soit le lien complet généré par l'organisateur (`.../t/{code}/join`, décodé
 * depuis un QR ou collé tel quel), soit le code seul.
 */
export function parseInviteInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/t\/([A-Za-z0-9]+)\/join\/?$/);
    if (match) candidate = match[1];
  } catch {
    // Pas une URL : on considère l'entrée comme le code lui-même.
  }

  const normalized = candidate.toUpperCase();
  return /^[A-Z0-9]{9}$/.test(normalized) ? normalized : null;
}
