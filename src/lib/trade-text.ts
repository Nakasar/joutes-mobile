import { TRADE_MAX_CARDS_PER_SIDE, TRADE_MAX_QUANTITY } from "./trade-constants";
import { normalizeCardName } from "./deck-text";

/**
 * Une offre d'échange en texte : une carte par ligne, sous la forme
 * « 2 Nom de la carte (EXT) 123 ».
 *
 * Copie de `lib/trade/text.ts` de joutes-app, couverte là-bas par des tests qui
 * rejouent les formes qu'on rencontre. Toute modification doit être reportée
 * dans les deux dépôts : une offre écrite sur le web doit se relire ici, et
 * réciproquement.
 *
 * C'est la forme que les joueurs s'échangent hors de l'application (message,
 * note, export d'un autre site), et celle que la vue « Texte » d'un espace
 * d'échange écrit et relit. Le code d'extension désigne l'impression, et le
 * numéro de collection la départage quand une extension porte plusieurs
 * versions d'une même carte — deux entrées de l'offre qui ne diffèrent que par
 * lui se confondraient sans lui, et l'une écraserait l'autre au retour.
 *
 * La lecture est volontairement permissive (« 2x Carte », « - Carte », « (EXT)
 * #123 », extension ou numéro absents) : une liste recopiée à la main n'a pas à
 * être exacte au caractère près pour être comprise. L'écriture, elle, ne
 * produit qu'une seule forme.
 */

/** Une carte d'offre, telle qu'une ligne de texte la décrit. */
export type TradeTextCard = {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
};

/** Une ligne lue. L'extension et le numéro manquent quand la ligne les tait. */
export type ParsedTradeLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
};

export type ParsedTradeText = {
  lines: ParsedTradeLine[];
  /** Lignes qui n'ont pu être lues comme une carte. */
  ignored: string[];
};

/**
 * Une ligne : puces et quantité en tête, puis la désignation de la carte.
 * Sans quantité, la ligne vaut un exemplaire.
 */
const LINE_PATTERN = /^[-•*]*\s*(?:[xX]?(\d+)\s*[xX]?\s+)?(.+)$/;

/**
 * La désignation : le nom, puis l'extension entre parenthèses et le numéro de
 * collection. Le nom est pris au plus large pour qu'un nom qui porte lui-même
 * des parenthèses (« Nom (version alternative) (EXT) 12 ») garde les siennes :
 * seule la dernière parenthèse sans espace fait un code d'extension.
 */
const DESIGNATION_PATTERN = /^(.*?)\s*\(([^()\s]{1,40})\)(?:\s*#?\s*([^()\s]{1,40}))?$/;

/** Clé de rapprochement d'une carte : nom normalisé, extension et numéro. */
export function tradeTextKey(card: {
  name: string;
  setCode?: string;
  collectorNumber?: string;
}): string {
  return [
    normalizeCardName(card.name),
    (card.setCode ?? "").toLowerCase(),
    (card.collectorNumber ?? "").toLowerCase(),
  ].join("|");
}

/** Réécrit une carte ou une ligne lue sous la forme canonique d'une ligne. */
export function formatTradeLine(card: {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
}): string {
  const set = card.setCode ? ` (${card.setCode})` : "";
  // Le numéro seul ne désigne rien : il ne s'écrit qu'avec son extension.
  const number = card.setCode && card.collectorNumber ? ` ${card.collectorNumber}` : "";
  return `${card.quantity} ${card.name}${set}${number}`;
}

/** Lit une offre collée. Les lignes vides et les commentaires sont ignorés. */
export function parseTradeText(text: string): ParsedTradeText {
  const lines: ParsedTradeLine[] = [];
  const ignored: string[] = [];
  const byKey = new Map<string, ParsedTradeLine>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;

    const match = line.match(LINE_PATTERN);
    const quantity = match?.[1] ? Number.parseInt(match[1], 10) : 1;
    const designation = (match?.[2] ?? "").trim();

    if (!designation || !Number.isFinite(quantity) || quantity <= 0) {
      ignored.push(line);
      continue;
    }

    const parts = designation.match(DESIGNATION_PATTERN);
    const name = (parts ? parts[1] : designation).trim();
    const setCode = parts?.[2];
    const collectorNumber = parts?.[3];

    if (!name) {
      ignored.push(line);
      continue;
    }

    const parsed: ParsedTradeLine = {
      quantity: Math.min(TRADE_MAX_QUANTITY, quantity),
      name,
      ...(setCode ? { setCode } : {}),
      ...(setCode && collectorNumber ? { collectorNumber } : {}),
    };

    // Deux lignes qui désignent la même impression se fondent : une liste qui
    // énumère les exemplaires un par un ne doit pas créer de doublons.
    const key = tradeTextKey(parsed);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.min(TRADE_MAX_QUANTITY, existing.quantity + parsed.quantity);
      continue;
    }

    byKey.set(key, parsed);
    lines.push(parsed);
  }

  return { lines, ignored };
}

/** Écrit une offre sous la forme lue par `parseTradeText`. */
export function stringifyTradeCards(cards: TradeTextCard[]): string {
  return cards.map((card) => formatTradeLine(card)).join("\n");
}

export type TradeTextApplication<T> = {
  /** Cartes appariées, dans l'ordre de la liste, exemplaires fusionnés. */
  entries: { card: T; quantity: number }[];
  /** Lignes qu'aucune carte n'a pu satisfaire, réécrites telles que lues. */
  unmatched: string[];
  /** Cartes appariées mais laissées dehors : une face ne porte pas plus de `maxCards`. */
  dropped: number;
};

/**
 * Transforme des lignes lues en contenu d'offre, en appariant chaque ligne à
 * une carte réelle.
 *
 * L'appariement lui-même n'est pas d'ici : il demande la collection ou le
 * catalogue, que l'application n'a pas. `resolve` le rend, et ce qu'il ne
 * reconnaît pas est signalé plutôt que passé sous silence — une liste collée de
 * travers ne doit pas remplacer une offre à moitié sans le dire.
 */
export function applyTradeText<T extends { key: string }>(
  lines: ParsedTradeLine[],
  resolve: (line: ParsedTradeLine, index: number) => T | undefined,
  maxCards: number = TRADE_MAX_CARDS_PER_SIDE,
): TradeTextApplication<T> {
  const entries: { card: T; quantity: number }[] = [];
  const byKey = new Map<string, { card: T; quantity: number }>();
  const unmatched: string[] = [];
  let dropped = 0;

  lines.forEach((line, index) => {
    const card = resolve(line, index);
    if (!card) {
      unmatched.push(formatTradeLine(line));
      return;
    }

    // Deux lignes peuvent désigner la même impression sans se ressembler —
    // l'une avec son numéro de collection, l'autre sans.
    const existing = byKey.get(card.key);
    if (existing) {
      existing.quantity = Math.min(TRADE_MAX_QUANTITY, existing.quantity + line.quantity);
      return;
    }

    if (entries.length >= maxCards) {
      dropped += 1;
      return;
    }

    const entry = { card, quantity: line.quantity };
    byKey.set(card.key, entry);
    entries.push(entry);
  });

  return { entries, unmatched, dropped };
}
