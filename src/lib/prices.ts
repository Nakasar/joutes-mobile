import type { CardMarketPrice } from "../api/types";
import { currentLocale } from "../i18n";

/**
 * Mise en forme des prix de marché des cartes — copie de `lib/prices/display.ts`
 * et `lib/prices/cardmarket.ts` de joutes-app : une même carte doit afficher le
 * même montant et renvoyer vers la même fiche des deux côtés. Toute
 * modification doit être reportée dans les deux dépôts.
 *
 * Les montants, eux, ne se calculent pas ici : l'API (et le document hors
 * ligne) livrent déjà le prix de référence de chaque carte.
 */

/**
 * Segment d'URL du jeu chez Cardmarket, par slug de jeu. Il ne se devine pas
 * (`fab` s'y écrit `FleshAndBlood`) : un jeu absent de cette table n'a pas de
 * lien, plutôt qu'un lien vers une page qui n'existe pas.
 */
export const CARDMARKET_GAME_PATHS: Record<string, string> = {
  mtg: "Magic",
  fab: "FleshAndBlood",
  riftbound: "Riftbound",
  swu: "StarWarsUnlimited",
};

/**
 * Page du produit d'où vient le prix. Cardmarket redirige cette forme vers la
 * fiche à partir de l'identifiant de son catalogue public — celui que portent
 * les relevés.
 */
export function cardmarketProductUrl(
  gameSlug: string | undefined,
  productId: number | undefined,
): string | undefined {
  const path = gameSlug ? CARDMARKET_GAME_PATHS[gameSlug] : undefined;

  if (!path || productId === undefined) {
    return undefined;
  }

  return `https://www.cardmarket.com/en/${path}/Products?idProduct=${productId}`;
}

/**
 * Montant dans la langue de l'application (`1,29 €`, `€1.29`). Une devise
 * inconnue de l'environnement ne doit pas faire tomber l'écran : le montant est
 * alors affiché tel quel, suivi de son code.
 */
export function formatCardPrice(
  price: CardMarketPrice,
  locale: string = currentLocale(),
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: price.currency,
    }).format(price.amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}
