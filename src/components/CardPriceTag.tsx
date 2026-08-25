import type { MarketPrice } from "../api/types";
import { formatCardPrice } from "../lib/prices";

/**
 * Prix d'une carte, en petit, sous son nom : galerie et grille de collection.
 * Le même composant sert partout, un prix devant se lire pareil d'un écran à
 * l'autre — c'est le pendant de `CardPriceTag` côté web.
 *
 * Le montant n'est pas cliquable ici : la vignette entière l'est déjà, et
 * c'est la fiche de la carte, à une touche, qui porte le lien vers Cardmarket.
 *
 * Sans relevé, le composant ne rend rien : une place vide vaut mieux qu'un
 * tiret que l'on prendrait pour un prix nul.
 */
export function CardPriceTag({
  price,
  className = "",
}: {
  price?: MarketPrice;
  className?: string;
}) {
  if (!price) {
    return null;
  }

  return (
    <span className={`card-price${className ? ` ${className}` : ""}`}>
      {formatCardPrice(price)}
    </span>
  );
}
