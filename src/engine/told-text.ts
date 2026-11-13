/**
 * Les noms dans une ligne du journal : joueurs et cartes, repérés pour être
 * mis en évidence (couleur du joueur, couleurs des domaines de la carte). Le
 * moteur écrit des phrases ; on y retrouve les noms tels qu'il les écrit.
 */

export type ToldSegment =
  | { kind: "text"; text: string }
  | { kind: "player"; text: string; seat: number }
  | { kind: "card"; text: string; code: string };

export type ToldIndex = {
  pattern: RegExp | null;
  players: Map<string, number>;
  cards: Map<string, string>;
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Les noms trop courts se confondraient avec des mots de la phrase. */
const MIN_CARD_NAME = 3;

/**
 * L'index des noms à repérer. Un joueur l'emporte sur une carte du même nom ;
 * entre deux noms qui se chevauchent, le plus long gagne (« Ahri, Alluring »
 * plutôt que « Ahri »).
 */
export function toldIndex(
  players: { seat: number; name: string }[],
  cards: { code: string; name: string }[],
): ToldIndex {
  const playerNames = new Map<string, number>();
  for (const player of players) if (player.name.trim()) playerNames.set(player.name, player.seat);
  const cardNames = new Map<string, string>();
  for (const card of cards) {
    if (card.name.length < MIN_CARD_NAME || playerNames.has(card.name) || cardNames.has(card.name)) continue;
    cardNames.set(card.name, card.code);
  }
  const names = [...playerNames.keys(), ...cardNames.keys()].sort((a, b) => b.length - a.length);
  // Un nom n'est repéré qu'entier : ni lettre ni chiffre juste avant ou après.
  const pattern =
    names.length > 0 ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  return { pattern, players: playerNames, cards: cardNames };
}

/** Découpe une ligne du journal en morceaux de texte, de joueurs et de cartes. */
export function splitTold(text: string, index: ToldIndex): ToldSegment[] {
  if (!index.pattern || !text) return text ? [{ kind: "text", text }] : [];
  const out: ToldSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(index.pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    const name = match[0];
    const seat = index.players.get(name);
    if (seat !== undefined) out.push({ kind: "player", text: name, seat });
    else out.push({ kind: "card", text: name, code: index.cards.get(name) as string });
    last = at + name.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Couleur d'un domaine, lisible sur fond clair comme sombre. */
export const DOMAIN_HEX: Record<string, string> = {
  fury: "#ef4444",
  calm: "#10b981",
  mind: "#0ea5e9",
  body: "#f97316",
  chaos: "#a855f7",
  order: "#eab308",
};

/** Couleurs des joueurs : vous en cyan, les autres dans l'ordre des sièges. */
const ME_COLOR = "#2bb7dc";
const OTHER_COLORS = ["#e0566b", "#a855f7", "#f59e0b"];

export function playerColor(seat: number, me: number | null, seats: number[]): string {
  if (me !== null && seat === me) return ME_COLOR;
  const others = me === null ? seats : seats.filter((value) => value !== me);
  const rank = others.indexOf(seat);
  if (me === null) return [ME_COLOR, ...OTHER_COLORS][rank % 4] ?? ME_COLOR;
  return OTHER_COLORS[rank % OTHER_COLORS.length] ?? OTHER_COLORS[0];
}
