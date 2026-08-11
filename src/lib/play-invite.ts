import { parseInviteInput } from "./tournament-invite";

/**
 * Ce qu'un code scanné ou collé désigne : un tournoi, ou une partie.
 *
 * Le joueur n'a pas à le dire avant de scanner. Les deux invitations ne se
 * ressemblent pas — un tournoi porte un code public de 9 caractères
 * (`/t/{code}/join`), une partie l'identifiant de son document Mongo
 * (`/api/game-matches/{id}/join`, 24 caractères hexadécimaux) —, et rien ne
 * peut passer pour l'autre : ni la longueur, ni l'alphabet.
 */
export type PlayInvite =
  | { kind: "tournament"; code: string }
  | { kind: "match"; matchId: string };

const MATCH_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Reconnaît l'identifiant d'une partie dans une invitation : le lien du QR
 * code (`/api/game-matches/{id}/join`), l'adresse de la fiche
 * (`/game-matches/{id}`, que l'on partage aussi), ou l'identifiant seul.
 */
function parseMatchInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/game-matches\/([0-9a-fA-F]{24})(?:\/join)?\/?$/);
    if (!match) return null;
    candidate = match[1];
  } catch {
    // Pas une URL : l'entrée est peut-être l'identifiant lui-même.
  }

  return MATCH_ID.test(candidate) ? candidate.toLowerCase() : null;
}

/**
 * Le tournoi est essayé d'abord : son code est le seul que l'on saisisse à la
 * main, et c'est donc lui qu'une entrée ambiguë est censée désigner. En
 * pratique aucune entrée ne l'est — 9 caractères contre 24.
 */
export function parsePlayInvite(raw: string): PlayInvite | null {
  const code = parseInviteInput(raw);
  if (code) return { kind: "tournament", code };

  const matchId = parseMatchInput(raw);
  if (matchId) return { kind: "match", matchId };

  return null;
}
