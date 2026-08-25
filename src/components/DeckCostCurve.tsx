import { useTranslation } from "react-i18next";
import type { DeckCardInfo, DeckCards } from "../lib/deck-contents";
import { costCurve } from "../lib/deck-contents";
import type { DeckZone } from "../lib/deck-zones";

/**
 * La courbe de coûts du deck, en barres.
 *
 * Seules les zones qui portent le drapeau `curve` y entrent — le deck
 * principal, en pratique : mêler les runes et les champs de bataille
 * écraserait la courbe sous une colonne « 0 » sans rapport avec ce qu'on lit.
 *
 * Rien ne s'affiche quand aucune carte du deck ne porte de coût : un jeu dont
 * le catalogue n'en déclare pas n'a pas de courbe, et une rangée de barres
 * vides ferait croire à un deck sans cartes.
 */
export function DeckCostCurve({
  cards,
  zones,
  cardsById,
}: {
  cards: DeckCards | undefined;
  zones: DeckZone[];
  cardsById: Map<string, DeckCardInfo>;
}) {
  const { t } = useTranslation();
  const buckets = costCurve(cards, zones, cardsById);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  if (total === 0) return null;

  return (
    <section className="card">
      <h3 className="section-label">{t("decks.costCurve")}</h3>
      <div className="deck-curve">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="deck-curve__col">
            <span className="deck-curve__count">{bucket.count || ""}</span>
            <div
              className="deck-curve__bar"
              /* La hauteur est une part du plus haut pilier, pas un nombre
                 absolu : une courbe se lit à sa forme. Un plancher visible
                 garde une colonne vide distincte d'une absence de colonne. */
              style={{ height: `${Math.round(bucket.ratio * 100)}%`, minHeight: 2 }}
              aria-hidden="true"
            />
            <span className="deck-curve__label">{bucket.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
