import type { PaintState, ProductKind } from "../api/types";

/**
 * Tables et règles d'affichage des produits, copie de `lib/constants/*` et
 * `lib/collection/product-ownership.ts` de joutes-app : toute modification doit
 * être reportée dans les deux dépôts.
 */

/** Types de produits, dans l'ordre où les filtres les présentent. */
export const PRODUCT_KIND_KEYS: ProductKind[] = [
  "box",
  "unit",
  "starter",
  "bundle",
  "accessory",
  "book",
  "other",
];

/**
 * États de peinture **dans l'ordre de progression** : l'échelle est ordonnée,
 * une figurine ne redescend pas de « peinte » à « montée ».
 */
export const PAINT_STATE_KEYS: PaintState[] = [
  "unassembled",
  "assembled",
  "primed",
  "partial",
  "painted",
  "based",
];

/**
 * Une figurine compte comme peinte à partir du moment où sa peinture est
 * terminée : « en cours » n'y suffit pas, c'est justement ce qu'il reste à
 * faire que la statistique doit montrer.
 */
export function isPainted(state: PaintState | undefined): boolean {
  return state === "painted" || state === "based";
}

/**
 * La tuile doit-elle porter la marque « tu as déjà tout le contenu » ?
 *
 * Elle ne s'allume que sur un conteneur **qu'on ne possède pas** : c'est le
 * seul cas où l'information change une décision d'achat. Sur une boîte déjà
 * possédée, l'anneau de possession dit l'essentiel.
 */
export function suggestsRedundantPurchase(product: {
  quantity?: number;
  content?: { complete: boolean };
}): boolean {
  return (product.quantity ?? 0) === 0 && product.content?.complete === true;
}
