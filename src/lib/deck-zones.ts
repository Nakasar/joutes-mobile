/**
 * Zones d'un deck — copie de `lib/decks/zones.ts` de joutes-app. Toute
 * modification doit être reportée dans les deux dépôts : c'est le serveur qui
 * enregistre le contenu zone par zone, et deux découpages différents feraient
 * lire au mobile un deck que le web range autrement.
 *
 * Un deck ne se range pas pareil selon le jeu : Riftbound sépare la légende,
 * les champions, les runes et les champs de bataille, là où la plupart des
 * autres TCG se contentent d'un deck principal, d'une réserve et d'une zone
 * supplémentaire. Les clés sont communes — c'est ce que porte le document en
 * base — et chaque jeu déclare celles qu'il utilise.
 *
 * **Un écart assumé avec le module d'origine** : là-bas, `label` et `short`
 * portent des libellés français en dur. Ici l'application parle quatre langues,
 * et ces champs ne servent qu'aux **règles** — l'appariement des en-têtes d'une
 * liste collée, notamment. Ce qui s'affiche passe par `t("decks.zones.<clé>")`.
 */

export const DECK_ZONE_KEYS = [
  "legend",
  "champions",
  "maindeck",
  "runes",
  "battlefields",
  "sideboard",
  "extra",
] as const;

export type DeckZoneKey = (typeof DECK_ZONE_KEYS)[number];

export function isDeckZoneKey(key: string): key is DeckZoneKey {
  return (DECK_ZONE_KEYS as readonly string[]).includes(key);
}

/**
 * Une zone telle qu'elle est **réglée** : deux bornes, et rien d'autre.
 *
 * `min` est un plancher, `max` un plafond ; les deux ensemble encadrent, égales
 * elles imposent un compte exact (12 runes), absentes toutes deux elles ne
 * contraignent rien. C'est la forme que le serveur sert dans
 * `game.deckBuilder.zones`, réglée depuis l'administration du site.
 */
export type DeckZone = {
  key: DeckZoneKey;
  /** Libellé de référence, celui qu'écrit une liste en texte. */
  label: string;
  /** Libellé court, reconnu lui aussi en tête d'une liste collée. */
  short: string;
  min?: number;
  max?: number;
  /** La zone compte dans la courbe de coûts (le deck principal, en pratique). */
  curve?: boolean;
  /**
   * Zone dont le plancher et le plafond comptent aussi les cartes de celle-ci.
   *
   * Le champion choisi de Riftbound est mis de côté, mais il fait partie des
   * 40 cartes du deck principal : un deck de 39 cartes plus son champion est
   * conforme.
   */
  countsTowards?: DeckZoneKey;
  /** Légendes ajoutées par Neeko (`deck-extra-legends.ts`) : la règle affichée le dit. */
  extraLegends?: number;
};

/** Réglages du deck builder d'un jeu, tels que le serveur les sert sur la fiche du jeu. */
export type GameDeckBuilder = {
  zones?: DeckZone[];
  /** Plafond d'exemplaires d'une même carte, toutes zones confondues. */
  maxCopies?: number;
  totalMin?: number;
  totalMax?: number;
  unlimitedTypes?: string[];
};

/** Zones de Riftbound, telles que les impose le format Standard. */
const RIFTBOUND_ZONES: DeckZone[] = [
  { key: "legend", label: "Légende", short: "Légende", min: 1, max: 1 },
  { key: "champions", label: "Champion choisi", short: "Champion", min: 1, max: 1, countsTowards: "maindeck" },
  { key: "maindeck", label: "Deck principal", short: "Principal", min: 40, curve: true },
  { key: "runes", label: "Runes", short: "Runes", min: 12, max: 12 },
  { key: "battlefields", label: "Battlefields", short: "Battlefields", min: 3, max: 3 },
  { key: "sideboard", label: "Réserve", short: "Réserve", max: 10 },
];

/** Zones par défaut, pour tout jeu qui n'en déclare pas de particulières. */
const GENERIC_ZONES: DeckZone[] = [
  { key: "maindeck", label: "Deck principal", short: "Principal", min: 60, curve: true },
  { key: "sideboard", label: "Réserve", short: "Réserve", max: 15 },
  { key: "extra", label: "Zone extra", short: "Extra", max: 15 },
];

/**
 * Zones du jeu passé en paramètre.
 *
 * Le découpage suit le jeu, pas le deck : deux decks du même jeu se rangent de
 * la même façon, et un deck qui porte des cartes dans une zone que son jeu
 * n'expose pas les garde en base — elles réapparaîtront si le jeu la déclare à
 * nouveau — mais ne les montre pas.
 */
export function getDeckZones(
  game?: { slug?: string | null; deckBuilder?: GameDeckBuilder | null } | string | null,
): DeckZone[] {
  if (typeof game === "string" || game === null || game === undefined) {
    return game === "riftbound" ? RIFTBOUND_ZONES : GENERIC_ZONES;
  }
  // Un jeu réglé depuis l'administration passe devant les tables livrées ; une
  // liste vide n'est pas un réglage et retombe sur elles.
  const configured = game.deckBuilder?.zones?.filter((zone) => isDeckZoneKey(zone.key));
  if (configured && configured.length > 0) return configured;
  return game.slug === "riftbound" ? RIFTBOUND_ZONES : GENERIC_ZONES;
}

/**
 * Les zones dont les cartes s'ajoutent au compte de `zone` pour juger de sa
 * taille — le champion choisi, pour le deck principal de Riftbound.
 */
export function contributingZones(zones: DeckZone[], zone: DeckZone): DeckZone[] {
  return zones.filter((other) => other.countsTowards === zone.key && other.key !== zone.key);
}

/** La zone visée par défaut : celle où va le gros du deck. */
export function defaultDeckZone(zones: DeckZone[]): DeckZoneKey {
  return zones.find((zone) => zone.curve)?.key ?? zones[0]?.key ?? "maindeck";
}

export function findDeckZone(zones: DeckZone[], key: string): DeckZone | undefined {
  return zones.find((zone) => zone.key === key);
}

/**
 * La zone est-elle dans les clous ?
 *
 * Une zone vide sans contrainte de plancher est conforme : un deck sans réserve
 * n'est pas un deck illégal.
 */
export function isZoneCompliant(zone: DeckZone, count: number): boolean {
  if (zone.min !== undefined && count < zone.min) return false;
  if (zone.max !== undefined && count > zone.max) return false;
  return true;
}

/**
 * Compteur affiché dans l'en-tête d'une zone : « 12 / 12 » quand il y a un
 * plafond, le seul nombre sinon — un plancher se lit mal en fraction, un deck
 * de 58 cartes sur 40 n'est pas « 58 / 40 ». « 39 + 1 = 40 » quand une zone liée
 * (le champion choisi) compte dans celle-ci : `count` est alors le total jugé.
 */
export function zoneCounterLabel(zone: DeckZone, count: number, contributed = 0): string {
  const own = contributed > 0 ? `${count - contributed} + ${contributed}` : String(count);
  if (zone.max !== undefined) return `${own} / ${zone.max}`;
  return contributed > 0 ? `${own} = ${count}` : own;
}

/** La règle d'une zone, à traduire : quelle phrase, et avec quels nombres. */
export function zoneRuleKey(zone: Pick<DeckZone, "min" | "max">): {
  key: "exact" | "range" | "min" | "max" | "none";
  min?: number;
  max?: number;
} {
  const { min, max } = zone;
  if (min !== undefined && max !== undefined) {
    return min === max ? { key: "exact", min } : { key: "range", min, max };
  }
  if (min !== undefined) return { key: "min", min };
  if (max !== undefined) return { key: "max", max };
  return { key: "none" };
}
