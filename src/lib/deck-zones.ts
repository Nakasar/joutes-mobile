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
 * Contrainte de taille d'une zone.
 *
 * `exact` veut dire « ni plus ni moins » (12 runes), `min` un plancher (40
 * cartes au minimum), `max` un plafond (10 cartes de réserve au plus). Une zone
 * sans contrainte — `none` — ne rend jamais le deck non conforme.
 */
export type DeckZoneBound = "exact" | "min" | "max" | "none";

export type DeckZone = {
  key: DeckZoneKey;
  /** Libellé de référence, celui qu'écrit une liste en texte. */
  label: string;
  /** Libellé court, reconnu lui aussi en tête d'une liste collée. */
  short: string;
  bound: DeckZoneBound;
  /** Nombre visé par la contrainte ; absent quand `bound` vaut `none`. */
  target?: number;
  /** La zone compte dans la courbe de coûts (le deck principal, en pratique). */
  curve?: boolean;
};

/** Zones de Riftbound, telles que les impose le format Standard. */
const RIFTBOUND_ZONES: DeckZone[] = [
  { key: "legend", label: "Légende", short: "Légende", bound: "exact", target: 1 },
  { key: "champions", label: "Champions", short: "Champions", bound: "max", target: 3 },
  { key: "maindeck", label: "Deck principal", short: "Principal", bound: "min", target: 40, curve: true },
  { key: "runes", label: "Runes", short: "Runes", bound: "exact", target: 12 },
  { key: "battlefields", label: "Battlefields", short: "Battlefields", bound: "exact", target: 3 },
  { key: "sideboard", label: "Réserve", short: "Réserve", bound: "max", target: 10 },
];

/** Zones par défaut, pour tout jeu qui n'en déclare pas de particulières. */
const GENERIC_ZONES: DeckZone[] = [
  { key: "maindeck", label: "Deck principal", short: "Principal", bound: "min", target: 60, curve: true },
  { key: "sideboard", label: "Réserve", short: "Réserve", bound: "max", target: 15 },
  { key: "extra", label: "Zone extra", short: "Extra", bound: "max", target: 15 },
];

/**
 * Zones du jeu passé en paramètre.
 *
 * Le découpage suit le jeu, pas le deck : deux decks du même jeu se rangent de
 * la même façon, et un deck qui porte des cartes dans une zone que son jeu
 * n'expose pas les garde en base — elles réapparaîtront si le jeu la déclare à
 * nouveau — mais ne les montre pas.
 */
export function getDeckZones(gameSlug?: string | null): DeckZone[] {
  return gameSlug === "riftbound" ? RIFTBOUND_ZONES : GENERIC_ZONES;
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
  if (zone.bound === "none" || zone.target === undefined) {
    return true;
  }

  switch (zone.bound) {
    case "exact":
      return count === zone.target;
    case "min":
      return count >= zone.target;
    case "max":
      return count <= zone.target;
  }
}

/**
 * Compteur affiché dans l'en-tête d'une zone : « 12 / 12 » quand il y a une
 * cible à atteindre ou à ne pas dépasser, le seul nombre sinon — un plancher se
 * lit mal en fraction, un deck de 58 cartes sur 40 n'est pas « 58 / 40 ».
 */
export function zoneCounterLabel(zone: DeckZone, count: number): string {
  if (zone.target !== undefined && (zone.bound === "exact" || zone.bound === "max")) {
    return `${count} / ${zone.target}`;
  }

  return String(count);
}
