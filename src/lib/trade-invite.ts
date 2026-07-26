/** Alphabet du code d'échange (sans 0/O ni 1/I/L), cf. `lib/db/trades.ts` côté API. */
const TRADE_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/**
 * Extrait le code d'un échange (8 caractères) d'une invitation saisie par
 * l'utilisateur : soit le lien complet (`.../trade/join/{code}`, décodé
 * depuis un QR ou collé tel quel), soit le code seul.
 */
export function parseTradeInviteInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/trade\/join\/([^/]+)\/?$/);
    if (match) candidate = match[1];
  } catch {
    // Pas une URL : on considère l'entrée comme le code lui-même.
  }

  const normalized = candidate.toUpperCase();
  return TRADE_CODE_PATTERN.test(normalized) ? normalized : null;
}
