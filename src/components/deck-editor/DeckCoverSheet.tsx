import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { uploadDeckCover } from "../../api/decks";
import { CachedImage } from "../CachedImage";
import type { DeckCardInfo } from "../../lib/deck-contents";
import { deckCoverPosition, type resolveDeckCover } from "../../lib/deck-cover";

/**
 * Choisir la carte qui illustre le deck — le bouton « Couverture » du site —
 * ou déposer sa propre image, qui prime sur la carte. Le choix part avec
 * « Enregistrer », comme le reste de l'éditeur ; l'image, elle, est déposée
 * tout de suite, mais rien ne l'affiche avant l'enregistrement.
 */
export function DeckCoverSheet({
  cover,
  candidates,
  cardsById,
  coverCardId,
  onChoose,
  deckId,
  uploaded,
  onUpload,
  onClose,
}: {
  cover: ReturnType<typeof resolveDeckCover>;
  candidates: string[];
  cardsById: Map<string, DeckCardInfo>;
  coverCardId: string | null;
  onChoose: (cardId: string | null) => void;
  deckId: string;
  /** L'image déposée retenue, ou `null` sans image. */
  uploaded: string | null;
  onUpload: (url: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onUpload(await uploadDeckCover(deckId, file));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  }

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
              {coverCardId && !uploaded && (
                <button className="btn btn--outline" onClick={() => onChoose(null)}>
                  {t("decks.cover.remove")}
                </button>
              )}
              <button
                className="btn btn--outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? t("decks.cover.uploading") : t("decks.cover.uploadAction")}
              </button>
              {uploaded && (
                <button className="btn btn--ghost" onClick={() => onUpload(null)}>
                  {t("decks.cover.removeUpload")}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  void pick(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
              {error && <p className="form-error">{error}</p>}
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
