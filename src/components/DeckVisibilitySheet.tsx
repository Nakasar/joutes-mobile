import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateDeck } from "../api/decks";
import type { Deck, DeckVisibility } from "../api/types";
import { DECK_VISIBILITIES } from "../api/types";
import { config } from "../config";

/**
 * Qui voit le deck — et le lien à partager.
 *
 * Les trois états sont montrés avec leur explication plutôt qu'en liste
 * déroulante : « non répertorié » ne se devine pas, et c'est précisément l'état
 * qu'un joueur cherche quand il veut montrer sa liste à son groupe sans la
 * publier au monde entier.
 */
export function DeckVisibilitySheet({
  deck,
  onSaved,
  onClose,
}: {
  deck: Deck;
  onSaved: (deck: Deck) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState<DeckVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${config.webUrl}/decks/${deck.id}`;

  async function choose(visibility: DeckVisibility) {
    if (visibility === deck.visibility) return;
    setSaving(visibility);
    setError(null);
    try {
      onSaved(await updateDeck(deck.id, { visibility }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : l'adresse reste affichée pour recopie.
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.visibility.action")}</h2>

          {DECK_VISIBILITIES.map((value) => (
            <button
              key={value}
              className={`deck-visibility-option${
                deck.visibility === value ? " deck-visibility-option--active" : ""
              }`}
              disabled={saving !== null}
              onClick={() => choose(value)}
            >
              <span className="deck-visibility-option__label">
                {t(`decks.visibility.${value}.label`)}
              </span>
              <span className="deck-visibility-option__hint">
                {t(`decks.visibility.${value}.hint`)}
              </span>
            </button>
          ))}

          {error && <p className="form-error">{error}</p>}

          {/* Un deck privé n'a pas de lien à partager : le donner laisserait
              croire qu'il s'ouvre, alors qu'il répond 403 à tout autre. */}
          {deck.visibility !== "private" && (
            <>
              <p className="muted" style={{ marginTop: 12, wordBreak: "break-all" }}>
                {shareUrl}
              </p>
              <button className="btn btn--outline btn--block" onClick={copyLink}>
                {copied ? t("decks.share.copied") : t("decks.share.copy")}
              </button>
            </>
          )}

          <button
            className="btn btn--outline btn--block"
            style={{ marginTop: 10 }}
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
