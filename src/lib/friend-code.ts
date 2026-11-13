/**
 * Codes ami, comme `lib/utils/friend-codes.ts` de joutes-app : huit
 * caractères d'un alphabet sans signes ambigus (ni 0/O, ni 1/I/L).
 */
const FRIEND_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/** Le lien qu'encode le QR d'un code ami, que le site sait ouvrir. */
export function friendCodeUrl(webUrl: string, code: string): string {
  return `${webUrl}/friends/add/${code}`;
}

/**
 * Extrait un code ami d'une saisie ou d'un QR : le lien `…/friends/add/{code}`
 * ou le code seul, en majuscules ou non. `null` sinon — la saisie est alors
 * un tag `pseudo#1234`.
 */
export function parseFriendCodeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/friends\/add\/([^/]+)\/?$/);
    if (!match) return null;
    candidate = match[1];
  } catch {
    // Pas une URL : la saisie est peut-être le code lui-même.
  }

  const normalized = candidate.toUpperCase();
  return FRIEND_CODE_PATTERN.test(normalized) ? normalized : null;
}
