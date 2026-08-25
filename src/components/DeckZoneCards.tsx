import { useTranslation } from "react-i18next";
import type { DeckCardInfo, DeckCards } from "../lib/deck-contents";
import { zoneCount, zoneEntries } from "../lib/deck-contents";
import { isZoneCompliant, zoneCounterLabel, type DeckZone } from "../lib/deck-zones";
import { CardImage } from "./CardImage";

/**
 * Une zone d'un deck : son en-tête, son compteur, et ses cartes.
 *
 * Le compteur dit l'état de la zone au regard de la règle du jeu — « 12 / 12 »
 * pour une cible exacte, le seul nombre pour un plancher : un deck de 58 cartes
 * sur 40 minimum n'est pas « 58 / 40 ». Une zone hors des clous se signale ici
 * plutôt qu'en bas de page : c'est là qu'on la corrige.
 *
 * Une carte que le catalogue ne rend pas garde sa place et son nombre
 * d'exemplaires : elle existe dans le deck, seule son illustration manque.
 */
export function DeckZoneCards({
  zone,
  cards,
  cardsById,
}: {
  zone: DeckZone;
  cards: DeckCards | undefined;
  cardsById: Map<string, DeckCardInfo>;
}) {
  const { t } = useTranslation();
  const entries = zoneEntries(cards, zone.key);

  if (entries.length === 0) return null;

  const count = zoneCount(cards, zone.key);
  const compliant = isZoneCompliant(zone, count);

  return (
    <section className="deck-zone">
      <div className="deck-zone__head">
        <h3 className="section-label">{t(`decks.zones.${zone.key}`)}</h3>
        <span className={`chip${compliant ? "" : " chip--danger"}`}>
          {zoneCounterLabel(zone, count)}
        </span>
      </div>

      <div className="deck-zone__grid">
        {entries.map((entry) => {
          const card = cardsById.get(entry.cardId);
          const label = card?.name ?? t("decks.unknownCard");
          return (
            <div key={entry.cardId} className="deck-thumb">
              {card?.image ? (
                <CardImage
                  src={card.image}
                  orientation={card.orientation}
                  alt={label}
                  loading="lazy"
                  cached
                  className="deck-thumb__image"
                />
              ) : (
                <span className="deck-thumb__placeholder">{label}</span>
              )}
              <span className="deck-thumb__qty">×{entry.quantity}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
