import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createErrata } from "../api/erratas";
import type { CardDetail, ErrataType } from "../api/types";
import { currentLocale } from "../i18n";

const ERRATA_TYPES: ErrataType[] = ["errata", "clarification", "ruling"];

/** Date du jour au format `yyyy-mm-dd` attendu par `<input type="date">`. */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Proposition d'un errata / d'une clarification / d'un ruling sur la carte
 * consultée. La création est ouverte à tout compte connecté : le contenu est
 * communautaire, arbitré ensuite par les votes et les signalements.
 */
export function SubmitErrataSheet({
  card,
  gameSlug,
  onClose,
  onCreated,
}: {
  card: CardDetail;
  gameSlug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<ErrataType>("errata");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState("");
  const [errataDate, setErrataDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = details.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    createErrata(gameSlug, {
      cardIds: [card.id],
      type,
      details: trimmed,
      source: source.trim() || undefined,
      // La date saisie est un jour civil : on la transmet à midi UTC pour
      // qu'aucun fuseau ne la fasse basculer sur la veille ou le lendemain.
      errataDate: errataDate ? `${errataDate}T12:00:00.000Z` : undefined,
      originalLang: currentLocale(),
    })
      .then(() => {
        onClose();
        onCreated();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("errata.submitTitle")}</h2>
          <p className="muted">{t("errata.submitIntro", { card: card.name })}</p>

          <div className="segmented">
            {ERRATA_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented__item${type === option ? " segmented__item--active" : ""}`}
                onClick={() => setType(option)}
              >
                {t(`errata.type${option.charAt(0).toUpperCase()}${option.slice(1)}`)}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field__label">{t("errata.detailsLabel")}</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.currentTarget.value)}
              placeholder={t("errata.detailsPlaceholder")}
              rows={5}
              maxLength={5000}
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">{t("errata.sourceFieldLabel")}</span>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.currentTarget.value)}
              placeholder={t("errata.sourcePlaceholder")}
              maxLength={500}
            />
          </label>

          <label className="field">
            <span className="field__label">{t("errata.dateLabel")}</span>
            <input
              type="date"
              value={errataDate}
              onChange={(e) => setErrataDate(e.currentTarget.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            onClick={submit}
            disabled={saving || details.trim().length === 0}
          >
            {saving ? t("common.saving") : t("errata.submitAction")}
          </button>
          <p className="muted form-sheet__note">{t("errata.submitNote")}</p>
        </div>
      </div>
    </div>
  );
}
