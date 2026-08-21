import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TournamentFormDecklistAnswer } from "../api/types";
import { CardImage } from "./CardImage";
import { AlertTriangleIcon, GridIcon, LayersIcon } from "./icons";

/**
 * Liste de deck telle que le serveur l'a analysée : vue liste pour vérifier des
 * quantités, vue visuelle pour reconnaître un deck d'un coup d'œil. Quand
 * l'analyse a échoué — ou que le jeu ne la supporte pas — la saisie brute reste
 * affichée telle quelle : c'est la seule trace de ce qui a été déclaré.
 */
export function TournamentDecklistView({
  decklist,
}: {
  decklist: TournamentFormDecklistAnswer;
}) {
  const { t } = useTranslation();
  const [visual, setVisual] = useState(false);
  const parsed = decklist.parsed;

  if (!parsed) {
    return (
      <div>
        {decklist.parseError && (
          <p className="decklist-warning">
            <AlertTriangleIcon size={15} />
            {t("tournamentForm.decklistParseError")}
          </p>
        )}
        <pre className="decklist-raw">{decklist.input}</pre>
      </div>
    );
  }

  return (
    <div className="decklist">
      <div className="decklist__head">
        <div className="segmented decklist__toggle">
          <button
            type="button"
            className={`segmented__item${visual ? "" : " segmented__item--active"}`}
            onClick={() => setVisual(false)}
            aria-pressed={!visual}
          >
            <LayersIcon size={15} />
            {t("tournamentForm.decklistViewList")}
          </button>
          <button
            type="button"
            className={`segmented__item${visual ? " segmented__item--active" : ""}`}
            onClick={() => setVisual(true)}
            aria-pressed={visual}
          >
            <GridIcon size={15} />
            {t("tournamentForm.decklistViewVisual")}
          </button>
        </div>
        <p className="decklist__count">
          {t("tournamentForm.decklistCount", { cards: parsed.totalCards })}
        </p>
      </div>

      {parsed.unrecognizedCards > 0 && (
        <p className="decklist-warning">
          <AlertTriangleIcon size={15} />
          {t("tournamentForm.decklistUnrecognized", { cards: parsed.unrecognizedCards })}
        </p>
      )}
      {parsed.bannedCards > 0 && (
        <p className="decklist-warning decklist-warning--banned">
          <AlertTriangleIcon size={15} />
          {t("tournamentForm.decklistBanned", { cards: parsed.bannedCards })}
        </p>
      )}

      {parsed.sections.map((section) => (
        <div key={section.key} className="decklist__section">
          {/* Un jeu peut nommer une section que la traduction ne connaît pas
              encore : la clé brute reste plus utile qu'un vide. */}
          <p className="decklist__section-title">
            {t(`tournamentForm.decklistSections.${section.key}`, { defaultValue: section.key })}
          </p>
          {visual ? (
            <div className="decklist__grid">
              {section.cards.map((card, index) => (
                <div key={`${card.cardId ?? card.name}-${index}`} className="decklist__tile">
                  {card.image ? (
                    <CardImage
                      cached
                      src={card.image}
                      orientation={card.orientation}
                      alt={card.name}
                      title={card.name}
                      className={`decklist__image${card.banned ? " decklist__image--banned" : ""}`}
                    />
                  ) : (
                    <span className="decklist__placeholder">{card.name}</span>
                  )}
                  <span className="decklist__quantity">×{card.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <ul className="decklist__list">
              {section.cards.map((card, index) => (
                <li key={`${card.cardId ?? card.name}-${index}`} className="decklist__row">
                  <span className="decklist__row-quantity">{card.quantity}</span>
                  <span
                    className={`decklist__row-name${
                      card.banned
                        ? " decklist__row-name--banned"
                        : card.recognized === false
                          ? " decklist__row-name--unknown"
                          : ""
                    }`}
                  >
                    {card.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
