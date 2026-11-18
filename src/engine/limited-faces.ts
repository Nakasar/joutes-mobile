/**
 * Ce que les écrans de scellé et de draft lisent d'une carte, quel que soit le
 * jeu : de quoi l'afficher, la trier et la compter. Chaque jeu traduit son
 * catalogue dans cette forme (`riftboundFaces`, `swuFaces`).
 */

import type { Pulled } from "./limited";

export type CardFace = {
  name: string;
  image?: string;
  /** Une carte qui se pose en paysage (champ de bataille, leader, base). */
  landscape: boolean;
  text?: string;
  /** Le coût, ou `null` pour une carte qui n'en a pas (Légende, leader, base…). */
  cost: number | null;
  /** Ses domaines ou ses aspects, par clé (`FaceGroup.key`). */
  groups: string[];
  /** « Unité », dans la langue de la page. */
  kind: string;
  /** « Unité · Ordre · coût 4 · Rare ». */
  line: string;
  /** Son rang de rareté : 0 pour la plus courante. */
  rarity: number;
  /** La couleur qui l'entoure à l'ouverture d'un booster, pour une rare ou mieux. */
  ring: string | null;
  /** Elle entre dans un deck principal : elle compte dans la courbe des coûts. */
  main: boolean;
};

/** Un domaine de Riftbound ou un aspect de Star Wars: Unlimited. */
export type FaceGroup = { key: string; label: string; color: string };

export type Faces = {
  get: (code: string) => CardFace | undefined;
  /** Le nom d'une carte, y compris celles que seul le limité connaît ; son code à défaut. */
  name: (code: string) => string;
  groups: FaceGroup[];
  /** « Domaine » ou « Aspect » : le nom du tri par groupe. */
  groupWord: string;
};

export type PackSort = "rarity" | "group" | "cost";
export const PACK_SORTS: PackSort[] = ["rarity", "group", "cost"];

/** Trie un paquet pour l'affichage, sans toucher à l'ordre que le moteur connaît. */
export function sortPack(pack: Pulled[], faces: Faces, sort: PackSort): Pulled[] {
  const order = faces.groups.map((group) => group.key);
  const group = (card: Pulled) => {
    const first = faces.get(card.code)?.groups[0];
    const at = first === undefined ? -1 : order.indexOf(first);
    return at < 0 ? order.length : at;
  };
  const key =
    sort === "rarity"
      ? (card: Pulled) => -(faces.get(card.code)?.rarity ?? 0)
      : sort === "group"
        ? group
        : (card: Pulled) => faces.get(card.code)?.cost ?? 0;
  return pack
    .map((card, index) => ({ card, index }))
    .sort((a, b) => key(a.card) - key(b.card) || a.index - b.index)
    .map(({ card }) => card);
}

/** Le nombre de cartes par groupe ; une carte de deux groupes compte dans chacun. */
export function groupCounts(codes: string[], faces: Faces): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const code of codes) {
    for (const group of new Set(faces.get(code)?.groups ?? [])) counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

/** La courbe des coûts des cartes de deck principal : huit colonnes, la dernière pour 7 et plus. */
export function faceCurve(codes: string[], faces: Faces): number[] {
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const code of codes) {
    const face = faces.get(code);
    if (face?.main && face.cost !== null) curve[Math.min(face.cost, 7)] += 1;
  }
  return curve;
}

/** Les codes des cartes de deck principal. */
export function mainOnly(codes: string[], faces: Faces): string[] {
  return codes.filter((code) => faces.get(code)?.main);
}
