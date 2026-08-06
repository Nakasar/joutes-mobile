import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPolicy } from "../api/policies";
import type { Policy } from "../api/types";
import { currentLocale } from "../i18n";

/**
 * Publication d'une politique (règle d'organisation, clarification) pour un
 * jeu. Réservée aux comptes portant `policies:update` : contrairement aux
 * erratas, les politiques font autorité et ne sont pas arbitrées par les votes.
 */
export function CreatePolicySheet({
  gameSlug,
  onClose,
  onCreated,
}: {
  gameSlug: string;
  onClose: () => void;
  onCreated: (policy: Policy) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;
    setSaving(true);
    setError(null);
    createPolicy(gameSlug, {
      title: trimmedTitle,
      content: trimmedContent,
      source: source.trim() || undefined,
      originalLang: currentLocale(),
    })
      .then((policy) => {
        onClose();
        onCreated(policy);
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
          <h2 className="form-sheet__title">{t("policies.createTitle")}</h2>

          <label className="field">
            <span className="field__label">{t("policies.titleLabel")}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder={t("policies.titlePlaceholder")}
              maxLength={200}
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">{t("policies.contentLabel")}</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
              placeholder={t("policies.contentPlaceholder")}
              rows={8}
              maxLength={20000}
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

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            onClick={submit}
            disabled={saving || title.trim().length === 0 || content.trim().length === 0}
          >
            {saving ? t("common.saving") : t("policies.createSubmit")}
          </button>
          <p className="muted form-sheet__note">{t("policies.createNote")}</p>
        </div>
      </div>
    </div>
  );
}
