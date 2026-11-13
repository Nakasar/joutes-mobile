/**
 * Correspondance entre les cartes Star Wars: Unlimited du catalogue Joutes et
 * celles du moteur.
 *
 * Le catalogue écrit `SOR-5` et `SOR-T01` pour un jeton ; le moteur écrit
 * `SOR-005` et `SOR-T01`. On passe par l'identifiant : le catalogue est en
 * français, le moteur en anglais.
 */

import type { SwuAspect, SwuKind } from "./types";

const JOUTES_ID = /^([A-Za-z0-9]+?)-(T?)(\d+)$/;

/** `SOR-5` → `SOR-005`. `null` si l'identifiant n'a pas la forme attendue. */
export function toSwuCode(cardId: string): string | null {
  const match = JOUTES_ID.exec(cardId.trim());
  if (!match) return null;
  const [, set, token, number] = match;
  return `${set.toUpperCase()}-${token ? `T${number.padStart(2, "0")}` : number.padStart(3, "0")}`;
}

/** `SOR-005` → `SOR-5`, l'identifiant de la carte au catalogue. */
export function toSwuCatalogId(code: string): string {
  const [set, number = ""] = code.split("-");
  return number.startsWith("T") ? code : `${set}-${Number(number)}`;
}

/** Extensions que le moteur sait jouer, de la plus ancienne à la plus récente. */
export const SWU_ENGINE_SETS = ["SOR", "SHD", "TWI", "JTL", "LOF", "SEC", "LAW", "ASH", "HMW"] as const;

/** Ce que la table affiche d'une carte : catalogue Joutes (français) et moteur réunis. */
export type SwuTableCard = {
  code: string;
  /** Le numéro de la carte dans le moteur (le `def` de ses évènements). */
  def: number;
  /** « Luke Skywalker, Ami Fidèle ». */
  name: string;
  /** Le nom sans le sous-titre, pour le récit et les libellés. */
  title: string;
  /** Le nom dans les phrases du moteur (anglais), que la table remplace par `title`. */
  engineName: string;
  kind: SwuKind;
  image?: string;
  /** La face unité d'un leader. */
  back?: string;
  text?: string;
  cost: number;
  power: number;
  hp: number;
  aspects: SwuAspect[];
  arena: "ground" | "space" | null;
  /** Faux pour une carte que le moteur ne sait pas jouer. */
  playable: boolean;
};

export type SwuTableCards = Record<string, SwuTableCard>;

/** Les leaders et les bases se posent en paysage. */
export function isLandscape(kind: SwuKind): boolean {
  return kind === "leader" || kind === "base";
}

/** La couleur de chaque aspect, celle des cartes. */
export const ASPECT_HEX: Record<SwuAspect, string> = {
  vigilance: "#3b82f6",
  command: "#22a35a",
  aggression: "#dc2626",
  cunning: "#eab308",
  heroism: "#f1f5f9",
  villainy: "#1f2937",
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Une phrase du moteur, découpée pour l'affichage : les noms de cartes (que le
 * moteur écrit en anglais) deviennent ceux du catalogue et sont rendus à part,
 * pour que la table les mette en valeur.
 */
/** Ce que la liste des decks lit d'un leader : nom, vignette, aspects. */
export function swuPickerCards(cards: SwuTableCards): Record<string, { name: string; image?: string; domains: string[] }> {
  return Object.fromEntries(
    Object.values(cards).map((card) => [card.code, { name: card.name, image: card.image, domains: [...new Set(card.aspects)] }]),
  );
}

export type SwuTextPart = { text: string; card?: string };

export function localizeSwuText(text: string, codes: Iterable<string>, cards: SwuTableCards): SwuTextPart[] {
  const known = [...new Set(codes)]
    .map((code) => cards[code])
    .filter((card): card is SwuTableCard => Boolean(card?.engineName))
    // Le plus long d'abord : « Luke Skywalker » avant « Luke ».
    .sort((a, b) => b.engineName.length - a.engineName.length);
  if (known.length === 0) return [{ text }];
  const pattern = new RegExp(`(${known.map((card) => escapeRegExp(card.engineName)).join("|")})`, "g");
  const parts: SwuTextPart[] = [];
  for (const piece of text.split(pattern)) {
    if (!piece) continue;
    const card = known.find((candidate) => candidate.engineName === piece);
    parts.push(card ? { text: card.title, card: card.code } : { text: piece });
  }
  return parts;
}
