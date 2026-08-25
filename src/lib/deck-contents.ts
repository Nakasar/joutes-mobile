import {
  DECK_ZONE_KEYS,
  isZoneCompliant,
  type DeckZone,
  type DeckZoneKey,
} from "./deck-zones";

/**
 * Contenu d'un deck et ce qui s'en déduit — copie de `lib/decks/contents.ts` de
 * joutes-app, couverte là-bas par des tests. Toute modification doit être
 * reportée dans les deux dépôts.
 *
 * Rien de ce qui se calcule ici n'est stocké : taille, légalité, courbe de
 * coûts et couverture par la collection sortent tous du contenu courant. C'est
 * ce qui garantit qu'une fiche et un éditeur ne disent jamais deux choses
 * différentes du même deck.
 */

/**
 * Une carte du deck, dans une zone : l'identifiant du catalogue et le nombre
 * d'exemplaires. Le nom n'est pas recopié — il vient du catalogue, seule source
 * à jour d'une carte (nom traduit, illustration, errata).
 */
export type DeckCardEntry = {
  cardId: string;
  quantity: number;
};

/** Contenu d'un deck, zone par zone. Une zone absente vaut zone vide. */
export type DeckCards = Partial<Record<DeckZoneKey, DeckCardEntry[]>>;

/** Ce que le deck a besoin de savoir d'une carte pour s'afficher et se compter. */
export type DeckCardInfo = {
  id: string;
  name: string;
  image?: string;
  type?: string;
  setCode?: string;
  collectorNumber?: string;
  /** Coût de jeu ; les cartes sans coût (légendes, runes) n'en ont pas. */
  cost?: number;
  domain?: string[];
  orientation?: "portrait" | "landscape";
};

export function zoneEntries(cards: DeckCards | undefined, zone: DeckZoneKey): DeckCardEntry[] {
  return cards?.[zone] ?? [];
}

export function zoneCount(cards: DeckCards | undefined, zone: DeckZoneKey): number {
  return zoneEntries(cards, zone).reduce((total, entry) => total + entry.quantity, 0);
}

/**
 * Taille du deck : la somme des zones que le jeu déclare.
 *
 * Bornée aux zones connues, sans quoi un deck importé d'un autre jeu — dont les
 * cartes dorment dans une zone que celui-ci n'expose pas — s'afficherait plus
 * gros que ce qu'il montre.
 */
export function deckSize(cards: DeckCards | undefined, zones: DeckZone[]): number {
  return zones.reduce((total, zone) => total + zoneCount(cards, zone.key), 0);
}

/**
 * Ajoute ou retire des exemplaires d'une carte dans une zone.
 *
 * Une quantité qui tombe à zéro sort la carte de la zone : une ligne à « 0 »
 * n'apporte rien et fausserait la lecture des compteurs.
 */
export function changeCardQuantity(
  cards: DeckCards,
  zone: DeckZoneKey,
  cardId: string,
  delta: number,
): DeckCards {
  const entries = zoneEntries(cards, zone).map((entry) => ({ ...entry }));
  const existing = entries.find((entry) => entry.cardId === cardId);

  if (existing) {
    existing.quantity += delta;
  } else if (delta > 0) {
    entries.push({ cardId, quantity: delta });
  }

  return { ...cards, [zone]: entries.filter((entry) => entry.quantity > 0) };
}

export function setCardQuantity(
  cards: DeckCards,
  zone: DeckZoneKey,
  cardId: string,
  quantity: number,
): DeckCards {
  const entries = zoneEntries(cards, zone).filter((entry) => entry.cardId !== cardId);

  if (quantity > 0) {
    entries.push({ cardId, quantity });
  }

  return { ...cards, [zone]: entries };
}

/** Tous les identifiants de carte du deck, sans doublon — de quoi charger le catalogue en une requête. */
export function deckCardIds(cards: DeckCards | undefined): string[] {
  const ids = new Set<string>();

  for (const key of DECK_ZONE_KEYS) {
    for (const entry of zoneEntries(cards, key)) {
      ids.add(entry.cardId);
    }
  }

  return [...ids];
}

export type DeckZoneLegality = {
  zone: DeckZone;
  count: number;
  compliant: boolean;
};

/**
 * État de chaque zone au regard de sa contrainte de taille. C'est de là que
 * sortent le badge de la fiche et celui des en-têtes de zone : les deux disent
 * la même chose parce qu'ils lisent le même calcul.
 */
export function deckLegality(cards: DeckCards | undefined, zones: DeckZone[]): DeckZoneLegality[] {
  return zones.map((zone) => {
    const count = zoneCount(cards, zone.key);
    return { zone, count, compliant: isZoneCompliant(zone, count) };
  });
}

export function isDeckCompliant(cards: DeckCards | undefined, zones: DeckZone[]): boolean {
  return deckLegality(cards, zones).every((row) => row.compliant);
}

/** Nombre de zones hors des clous, pour le badge « N zones à ajuster ». */
export function countNonCompliantZones(cards: DeckCards | undefined, zones: DeckZone[]): number {
  return deckLegality(cards, zones).filter((row) => !row.compliant).length;
}

export type CostCurveBucket = {
  /** Libellé de la colonne : « 0 » à « 5 », puis « 6+ ». */
  label: string;
  count: number;
  /** Part du plus haut pilier, entre 0 et 1 — la hauteur de la barre. */
  ratio: number;
};

/** Dernier palier de la courbe : au-delà, tout se regroupe (« 6+ »). */
export const COST_CURVE_MAX = 6;

/**
 * Courbe de coûts du deck.
 *
 * Seules les zones qui portent le drapeau `curve` sont comptées : mêler les
 * runes et les champs de bataille au deck principal écraserait la courbe sous
 * une colonne « 0 » sans rapport avec ce que l'on cherche à lire.
 */
export function costCurve(
  cards: DeckCards | undefined,
  zones: DeckZone[],
  cardsById: Map<string, DeckCardInfo>,
): CostCurveBucket[] {
  const buckets = new Array<number>(COST_CURVE_MAX + 1).fill(0);

  for (const zone of zones.filter((z) => z.curve)) {
    for (const entry of zoneEntries(cards, zone.key)) {
      const cost = cardsById.get(entry.cardId)?.cost;
      if (typeof cost !== "number" || Number.isNaN(cost)) {
        continue;
      }
      const bucket = Math.min(Math.max(Math.trunc(cost), 0), COST_CURVE_MAX);
      buckets[bucket] += entry.quantity;
    }
  }

  const max = Math.max(1, ...buckets);

  return buckets.map((count, cost) => ({
    label: cost === COST_CURVE_MAX ? `${COST_CURVE_MAX}+` : String(cost),
    count,
    ratio: count / max,
  }));
}

/** Répartition du deck par type de carte, du plus représenté au moins représenté. */
export function typeSplit(
  cards: DeckCards | undefined,
  zones: DeckZone[],
  cardsById: Map<string, DeckCardInfo>,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const zone of zones) {
    for (const entry of zoneEntries(cards, zone.key)) {
      const type = cardsById.get(entry.cardId)?.type;
      if (!type) continue;
      counts.set(type, (counts.get(type) ?? 0) + entry.quantity);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

/**
 * Nombre maximum d'exemplaires d'une même carte, toutes zones confondues.
 *
 * Les zones à cible exacte d'une carte unique (la légende) en sont exclues :
 * elles ont déjà leur propre règle, et une rune jouée douze fois n'est pas une
 * infraction.
 */
export function maxCopies(
  cards: DeckCards | undefined,
  zones: DeckZone[],
  exclude: DeckZoneKey[] = ["runes", "legend", "battlefields"],
): number {
  const counts = new Map<string, number>();

  for (const zone of zones.filter((z) => !exclude.includes(z.key))) {
    for (const entry of zoneEntries(cards, zone.key)) {
      counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + entry.quantity);
    }
  }

  return Math.max(0, ...counts.values());
}
