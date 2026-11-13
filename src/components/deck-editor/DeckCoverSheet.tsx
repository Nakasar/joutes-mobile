import { useTranslation } from "react-i18next";
import { CachedImage } from "../CachedImage";
import type { DeckCardInfo } from "../../lib/deck-contents";
import { deckCoverPosition, type resolveDeckCover } from "../../lib/deck-cover";

/**
 * Choisir la carte qui illustre le deck — le bouton « Couverture » du site.
 * Le choix part avec « Enregistrer », comme le reste de l'éditeur.
 */
export function DeckCoverSheet({
  cover,
  candidates,
  cardsById,
  coverCardId,
  onChoose,
  onClose,
}: {
  cover: ReturnType<typeof resolveDeckCover>;
  candidates: string[];
  cardsById: Map<string, DeckCardInfo>;
  coverCardId: string | null;
  onChoose: (cardId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.cover.title")}</h2>
          <div className="cover-picker">
            <div
              className="cover-picker__preview"
              style={cover.image ? undefined : { background: "var(--surface-2)" }}
            >
              {cover.image && (
                <CachedImage src={cover.image} alt="" style={{ objectPosition: deckCoverPosition(cover.source) }} />
              )}
            </div>
            <div className="cover-picker__body">
              <p className="muted cover-picker__hint">
                {cover.source === "upload"
                  ? t("decks.cover.upload")
                  : cover.source === "card"
                    ? t("decks.cover.card", { name: cardsById.get(cover.cardId ?? "")?.name ?? "" })
                    : cover.source === "legend"
                      ? t("decks.cover.legend")
                      : t("decks.cover.none")}
              </p>
              {coverCardId && (
                <button className="btn btn--outline" onClick={() => onChoose(null)}>
                  {t("decks.cover.remove")}
                </button>
              )}
            </div>
          </div>
          {candidates.length > 0 && (
            <div className="cover-picker__strip">
              {candidates.map((cardId) => {
                const card = cardsById.get(cardId);
                if (!card?.image) return null;
                return (
                  <button
                    key={cardId}
                    className={`cover-picker__candidate${coverCardId === cardId ? " cover-picker__candidate--active" : ""}`}
                    onClick={() => onChoose(cardId)}
                    aria-label={card.name}
                    aria-pressed={coverCardId === cardId}
                  >
                    <CachedImage src={card.image} alt="" loading="lazy" />
                  </button>
                );
              })}
            </div>
          )}
          <button className="btn btn--grad btn--block" style={{ marginTop: 14 }} onClick={onClose}>
            {t("decks.editor.catalog.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
