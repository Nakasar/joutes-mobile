import type { CardPrinting } from "../api/types";

/**
 * Résolution de la variante d'impression retenue pour un exemplaire. Copie de
 * `lib/cards/printings.ts` côté joutes-app : toute modification doit être
 * reportée dans les deux dépôts.
 */

/** Ce dont on a besoin d'une carte pour résoudre une variante d'impression. */
export interface PrintableCard {
  foil?: boolean;
  image?: string;
  printings?: CardPrinting[];
}

/**
 * Variante retenue pour un exemplaire (collection, wishlist, liste de vente).
 * `printingId` absent = version de base de la carte.
 */
export interface PrintingChoice {
  printingId?: string;
  /** Libellé recopié sur l'exemplaire, pour l'afficher sans relire la carte. */
  printingName?: string;
  foil: boolean;
  image?: string;
}

/**
 * Résout la variante choisie. La version de base reprend l'illustration et le
 * caractère foil de la carte ; une variante imprimée en foil impose le foil, et
 * son illustration si elle en a une. Un identifiant inconnu (variante retirée
 * depuis) retombe sur la version de base plutôt que d'échouer.
 */
export function resolvePrinting(
  card: PrintableCard,
  printingId?: string,
): PrintingChoice {
  const printing = printingId
    ? card.printings?.find((item) => item.id === printingId)
    : undefined;

  if (!printing) {
    return { foil: card.foil === true, image: card.image };
  }

  return {
    printingId: printing.id,
    printingName: printing.name,
    foil: printing.foil === true || card.foil === true,
    image: printing.image || card.image,
  };
}

/**
 * Le choix du foil est verrouillé lorsque la carte n'existe qu'en foil ou que
 * la variante retenue est imprimée en foil.
 */
export function isFoilForced(card: PrintableCard, printingId?: string): boolean {
  return resolvePrinting(card, printingId).foil;
}
