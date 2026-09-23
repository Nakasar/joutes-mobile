import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setLairNotificationPreference } from "../api/lairs";
import {
  LAIR_NOTIFICATION_CATEGORIES,
  LAIR_NOTIFICATION_LEVELS,
  type LairNotificationCategory,
  type LairNotificationLevel,
  type LairNotificationPreference,
} from "../api/types";
import { CheckIcon } from "./icons";

/**
 * Ce qu'on reçoit d'un lieu suivi : tout, une sélection, ou rien.
 *
 * Chaque choix s'enregistre aussitôt, comme la visibilité d'un deck : c'est un
 * réglage, pas un formulaire. Passer en « Personnalisé » part de tous les
 * types cochés — ce qu'on recevait en « Tout » — pour n'avoir qu'à décocher.
 */
export function LairNotificationSheet({
  lairId,
  preference,
  onSaved,
  onClose,
}: {
  lairId: string;
  preference: LairNotificationPreference;
  onSaved: (preference: LairNotificationPreference) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: LairNotificationPreference) {
    setSaving(true);
    setError(null);
    try {
      onSaved(await setLairNotificationPreference(lairId, next));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function chooseLevel(level: LairNotificationLevel) {
    if (level === preference.level) return;
    void save(
      level === "custom"
        ? { level, categories: [...LAIR_NOTIFICATION_CATEGORIES] }
        : { level },
    );
  }

  function toggleCategory(category: LairNotificationCategory) {
    if (preference.level !== "custom") return;
    const categories = preference.categories.includes(category)
      ? preference.categories.filter((value) => value !== category)
      : [...preference.categories, category];
    void save({ level: "custom", categories });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("lairs.notifications.title")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("lairs.notifications.description")}
          </p>

          {LAIR_NOTIFICATION_LEVELS.map((level) => (
            <div key={level}>
              <button
                className={`deck-visibility-option${
                  preference.level === level ? " deck-visibility-option--active" : ""
                }`}
                aria-pressed={preference.level === level}
                disabled={saving}
                onClick={() => chooseLevel(level)}
              >
                <span className="deck-visibility-option__label">
                  {t(`lairs.notifications.levels.${level}.label`)}
                </span>
                <span className="deck-visibility-option__hint">
                  {t(`lairs.notifications.levels.${level}.hint`)}
                </span>
              </button>

              {level === "custom" && preference.level === "custom" && (
                <div className="lair-notification-categories">
                  {LAIR_NOTIFICATION_CATEGORIES.map((category) => {
                    const checked = preference.categories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`toggle-row${checked ? " toggle-row--active" : ""}`}
                        aria-pressed={checked}
                        disabled={saving}
                        onClick={() => toggleCategory(category)}
                      >
                        <span className="toggle-row__box">
                          {checked && <CheckIcon size={14} />}
                        </span>
                        <span className="toggle-row__label">
                          {t(`lairs.notifications.categories.${category}`)}
                        </span>
                      </button>
                    );
                  })}
                  {preference.categories.length === 0 && (
                    <p className="muted">{t("lairs.notifications.emptyCustom")}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && <p className="form-error">{error}</p>}

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
