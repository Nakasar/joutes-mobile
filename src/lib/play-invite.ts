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
  | { kind: "match"; matchId: string }
  /** Une table en ligne du mode Jouer ; `game` est nul pour un code seul, qui ne dit pas son jeu. */
  | { kind: "table"; game: "riftbound" | "swu" | null; id: string }
  /** Une partie sur le serveur d'un hôte (mode hôte). */
  | { kind: "remote"; game: "riftbound" | "swu"; server: string; ticket: string };

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

/** L'identifiant d'une table en ligne : 8 caractères, sans voyelles ni chiffres ambigus. */
const TABLE_ID = /^[bcdfghjkmnpqrstvwxz23456789]{8}$/;

function playGameOf(segment: string | undefined): "riftbound" | "swu" | null {
  return segment === "riftbound" || segment === "swu" ? segment : null;
}

/**
 * Une invitation du mode Jouer : le lien d'une table du site
 * (`/games/{jeu}/play/table?id=…`, préfixe de langue toléré), le lien d'une
 * partie hébergée (`/games/{jeu}/play/remote#server=…&ticket=…`), ou le code
 * d'une table seul.
 */
function parseTableInput(raw: string): PlayInvite | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/games\/([a-z0-9-]+)\/play\/(table|remote)\/?$/);
    const game = playGameOf(match?.[1]);
    if (!match || !game) return null;
    if (match[2] === "table") {
      const id = url.searchParams.get("id")?.toLowerCase() ?? "";
      return TABLE_ID.test(id) ? { kind: "table", game, id } : null;
    }
    const params = new URLSearchParams(url.hash.slice(1));
    const server = params.get("server");
    const ticket = params.get("ticket");
    return server && ticket ? { kind: "remote", game, server, ticket } : null;
  } catch {
    const id = trimmed.toLowerCase();
    return TABLE_ID.test(id) ? { kind: "table", game: null, id } : null;
  }
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

  return parseTableInput(raw);
}
