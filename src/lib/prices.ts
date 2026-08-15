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
 * Formateurs déjà construits, par langue et par devise.
 *
 * Une grille de collection affiche trente prix par page et en empile autant à
 * chaque « charger plus » : construire un `Intl.NumberFormat` par prix et par
 * rendu revient à refaire le même travail des centaines de fois. Ils ne
 * dépendent que du couple (langue, devise), qui ne change presque jamais — le
 * cache tient donc en une poignée d'entrées.
 *
 * Cette mémoïsation est propre au mobile : côté web, un prix est mis en forme
 * une fois par rendu serveur, sans liste à faire défiler.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  const cached = formatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  formatters.set(key, formatter);
  return formatter;
}

/**
 * Un montant et sa devise, dans la langue de l'application (`1,29 €`,
 * `€1.29`). Une devise inconnue de l'environnement ne doit pas faire tomber
 * l'écran : le montant est alors affiché tel quel, suivi de son code.
 *
 * Le prix d'une carte et la valeur d'une collection s'écrivent pareil — seule
 * la paire montant/devise compte —, mais ce sont deux choses différentes : ce
 * formateur ne prend que ce qu'il lui faut, plutôt que de faire passer l'une
 * pour l'autre.
 */
export function formatMoney(
  money: { amount: number; currency: string },
  locale: string = currentLocale(),
): string {
  try {
    return currencyFormatter(locale, money.currency).format(money.amount);
  } catch {
    return `${money.amount} ${money.currency}`;
  }
}

/** Le prix de marché d'une carte, mis en forme. */
export function formatCardPrice(
  price: CardMarketPrice,
  locale: string = currentLocale(),
): string {
  return formatMoney(price, locale);
}
