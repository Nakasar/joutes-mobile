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
 * (casse libre), ou le code seul tel qu'il s'affiche, en majuscules. `null`
 * sinon — la saisie est alors un pseudo ou un tag `pseudo#1234` : un pseudo
 * de huit lettres en minuscules (« superman ») ne doit pas passer pour un code.
 */
export function parseFriendCodeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/friends\/add\/([^/]+)\/?$/);
    if (!match) return null;
    const code = match[1].toUpperCase();
    return FRIEND_CODE_PATTERN.test(code) ? code : null;
  } catch {
    // Pas une URL : la saisie est peut-être le code lui-même.
  }
  return FRIEND_CODE_PATTERN.test(trimmed) ? trimmed : null;
}
