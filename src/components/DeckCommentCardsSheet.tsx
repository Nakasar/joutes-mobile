import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DeckCardInfo } from "../lib/deck-contents";

/** Dix cartes au plus par commentaire : la règle du serveur. */
export const MAX_COMMENT_CARDS = 10;

/**
 * « Lier des cartes » : les cartes du deck, à cocher. Sur le site, on lie une
 * carte depuis sa rangée dans la liste ; sur un téléphone, une liste à cocher
 * se parcourt mieux au pouce.
 */
export function DeckCommentCardsSheet({
  cardIds,
  cardsById,
  initial,
  onDone,
  onClose,
}: {
  cardIds: string[];
  cardsById: Map<string, DeckCardInfo>;
  initial: string[];
  onDone: (cardIds: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState("");

  const cards = cardIds
    .map((id) => ({ id, name: cardsById.get(id)?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((card) => card.name.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(cardId: string) {
    setPicked((previous) =>
      previous.includes(cardId)
        ? previous.filter((id) => id !== cardId)
        : previous.length < MAX_COMMENT_CARDS
          ? [...previous, cardId]
          : previous,
    );
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.comments.linkCards")}</h2>
          <input
            type="search"
            placeholder={t("decks.comments.searchCards")}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ marginBottom: 10 }}
          />
          <p className="muted" style={{ marginBottom: 8 }}>
            {t("decks.comments.cardsPicked", { count: picked.length, max: MAX_COMMENT_CARDS })}
          </p>
          <div className="check-list">
            {cards.map((card) => (
              <label key={card.id} className="check-row">
                <input
                  type="checkbox"
                  checked={picked.includes(card.id)}
                  disabled={!picked.includes(card.id) && picked.length >= MAX_COMMENT_CARDS}
                  onChange={() => toggle(card.id)}
                />
                <span className="check-row__body">
                  <span className="check-row__title">{card.name}</span>
                </span>
              </label>
            ))}
          </div>
          <button className="btn btn--grad btn--block" onClick={() => onDone(picked)}>
            {t("decks.comments.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
