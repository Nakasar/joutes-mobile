import { useTranslation } from "react-i18next";
import type { CardMarketPrice } from "../api/types";
import { cardmarketProductUrl, formatCardPrice } from "../lib/prices";
import { currentLocale } from "../i18n";
import { ExternalLinkIcon } from "./icons";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Le prix de marché sur la fiche d'une carte : le montant, d'où il vient et de
 * quand il date.
 *
 * Ailleurs (galerie, collection) un chiffre suffit (`CardPriceTag`) ; ici il y
 * a la place de dire ce qu'il vaut vraiment — un prix « à partir de », relevé
 * un jour donné sur le tirage le moins cher de la carte.
 *
 * Le montant renvoie à la fiche Cardmarket du produit d'où il sort, quand le
 * jeu y est connu. Sans relevé, l'écran le dit plutôt que de laisser un vide :
 * c'est ici, et nulle part ailleurs, qu'une carte sans prix s'explique.
 */
export function CardPriceDetails({
  price,
  gameSlug,
}: {
  price?: CardMarketPrice;
  gameSlug?: string;
}) {
  const { t } = useTranslation();

  if (!price) {
    return <p className="card-price-details__none">{t("prices.none")}</p>;
  }

  const date = formatDate(price.updatedAt);
  const url = cardmarketProductUrl(gameSlug, price.productId);
  const amount = formatCardPrice(price);

  return (
    <section className="card-price-details">
      <div className="card-price-details__head">
        <span className="card-price-details__label">{t("prices.title")}</span>
        {url ? (
          <a
            className="card-price-details__amount"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("prices.openOnCardmarket", { date })}
          >
            {amount}
            <ExternalLinkIcon size={14} />
          </a>
        ) : (
          <span className="card-price-details__amount">{amount}</span>
        )}
      </div>
      <p className="card-price-details__source">
        {t("prices.from")} · {t("prices.source", { date })}
      </p>
    </section>
  );
}
