import type { MarketPrice, CardPriceSource } from "../api/types";
import { currentLocale } from "../i18n";

/**
 * Mise en forme des prix de marché des cartes — copie de `lib/prices/display.ts`,
 * `lib/prices/sources.ts`, `lib/prices/cardmarket.ts` et
 * `lib/prices/cardnexus.ts` de joutes-app : une même carte doit afficher le
 * même montant et renvoyer vers la même fiche des deux côtés. Toute
 * modification doit être reportée dans les deux dépôts.
 *
 * Les montants, eux, ne se calculent pas ici : l'API (et le document hors
 * ligne) livrent déjà le prix de référence de chaque carte, et le serveur a
 * déjà choisi le fournisseur qui la représente — celui que le joueur a réglé
 * sur le web, à défaut celui de la plateforme.
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
 * Identifiant CardNexus des jeux, par slug de jeu. Comme pour Cardmarket, il ne
 * se devine pas : un jeu absent de cette table n'a pas de lien CardNexus.
 * Yu-Gi-Oh n'y figure pas, quand Cardmarket le connaît.
 */
export const CARDNEXUS_GAME_IDS: Record<string, string> = {
  mtg: "mtg",
  pokemon: "pokemon",
  fab: "fab",
  op: "onepiece",
  lorcana: "lorcana",
  swu: "swu",
  riftbound: "riftbound",
};

/**
 * Page du produit chez CardNexus. L'adresse porte des segments lisibles — jeu,
 * extension, nom — dont CardNexus ne lit que l'identifiant final : toute autre
 * adresse de la même forme y est redirigée, d'où les segments neutres.
 */
export function cardnexusProductUrl(
  gameSlug: string | undefined,
  productId: number | undefined,
): string | undefined {
  const gameId = gameSlug ? CARDNEXUS_GAME_IDS[gameSlug] : undefined;

  if (!gameId || productId === undefined) {
    return undefined;
  }

  return `https://cardnexus.com/en/explore/${gameId}/card/card/card-${productId}`;
}

/**
 * Nom d'une place de marché. Ce sont des marques : elles s'écrivent pareil dans
 * toutes les langues, et ne passent donc pas par les traductions.
 */
export const PRICE_SOURCE_LABELS: Record<CardPriceSource, string> = {
  cardnexus: "CardNexus",
  cardmarket: "Cardmarket",
};

/**
 * Page du produit d'où vient un prix, chez la place de marché qui l'a relevé.
 *
 * Un prix ne se lit pas sans savoir qui le publie — deux places de marché ne
 * cotent pas la même chose au même moment — et un lien construit pour l'une
 * mène à une page inexistante chez l'autre. D'où ce point de passage unique,
 * plutôt qu'un `if` par écran.
 *
 * `undefined` quand l'adresse ne se construit pas (jeu inconnu de la place de
 * marché, relevé sans produit) : le prix s'affiche alors sans lien plutôt
 * qu'avec un lien mort.
 */
export function marketProductUrl(
  source: CardPriceSource,
  gameSlug: string | undefined,
  productId: number | undefined,
): string | undefined {
  return source === "cardnexus"
    ? cardnexusProductUrl(gameSlug, productId)
    : cardmarketProductUrl(gameSlug, productId);
}

/** Le nom de la place de marché d'où vient un prix. */
export function priceSourceLabel(source: CardPriceSource): string {
  return PRICE_SOURCE_LABELS[source] ?? source;
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
  price: MarketPrice,
  locale: string = currentLocale(),
): string {
  return formatMoney(price, locale);
}
