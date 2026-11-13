/**
 * Correspondance entre les cartes du catalogue Joutes et celles du moteur.
 *
 * Le catalogue écrit `OGN001`, et `OGN030a` pour une variante d'illustration ;
 * le moteur écrit `OGN-001` et ne connaît qu'une carte par numéro. On passe par
 * l'identifiant et jamais par le nom : une légende s'appelle « Volibear,
 * Relentless Storm » au catalogue et « Relentless Storm » dans le moteur.
 */

import type { Matter } from "./card-fx";

const JOUTES_ID = /^([A-Za-z]+)-?(\d+)([a-z*]*)$/;

/** `OGN030a` → `OGN-030`. `null` si l'identifiant n'a pas la forme attendue. */
export function toEngineCode(cardId: string): string | null {
  const match = JOUTES_ID.exec(cardId.trim());
  if (!match) return null;
  return `${match[1].toUpperCase()}-${match[2].padStart(3, "0")}`;
}

/** `OGN-030` → `OGN030`, l'identifiant de la carte de base au catalogue. */
export function toCatalogId(engineCode: string): string {
  return engineCode.replace("-", "");
}

/** Extensions que le moteur sait jouer. */
export const ENGINE_SETS = ["OGS", "OGN", "SFD", "UNL", "VEN", "RAD"] as const;

/** Ce que la table affiche d'une carte : catalogue Joutes et moteur réunis. */
export type TableCard = {
  code: string;
  name: string;
  kind: "unit" | "gear" | "spell" | "rune" | "legend" | "battlefield";
  image?: string;
  landscape?: boolean;
  text?: string;
  might?: number;
  energy: number;
  power: number;
  domains: string[];
  champion?: boolean;
  token?: boolean;
  /** Faux pour une carte que le moteur ne sait pas jouer. */
  playable: boolean;
  /** Le numéro de la carte dans le moteur (le `def` de ses évènements). */
  def?: number;
  /** La matière de ses effets sur la table, quand ce n'est pas la couleur de son domaine. */
  fx?: Matter;
};

export type TableCards = Record<string, TableCard>;

const RUNE_NAMES: Record<string, string> = {
  fury: "Fury",
  calm: "Calm",
  mind: "Mind",
  body: "Body",
  chaos: "Chaos",
  order: "Order",
  rainbow: "Any",
};

/**
 * Le texte d'une carte tel que le moteur le porte écrit ses symboles en codes
 * (`:rb_energy_2:`, `:rb_exhaust:`). La table les montre en clair, dans la
 * langue du texte (l'anglais des cartes).
 */
export function readableCardText(text: string): string {
  return text
    .replace(/:rb_energy_(\d+):/g, "[$1]")
    .replace(/:rb_exhaust:/g, "[Exhaust]")
    .replace(/:rb_might:/g, "Might")
    .replace(/:rb_rune_([a-z]+):/g, (_, rune: string) => `[${RUNE_NAMES[rune] ?? rune}]`);
}
