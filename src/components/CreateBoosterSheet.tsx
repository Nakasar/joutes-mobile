import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { boosterTypesFor, createBooster } from "../api/boosters";
import { getQuickAddSets } from "../api/collection";
import type { Game, QuickAddSet } from "../api/types";
import { useBoosterTypeLabel } from "../hooks/useBoosterTypeLabel";

/**
 * Nouveau booster : son extension, sa langue imprimée et son type, comme le
 * formulaire du site. Les cartes s'ajoutent ensuite, au scan ou par nom.
 */
export function CreateBoosterSheet({
  game,
  onClose,
  onCreated,
}: {
  game: Game;
  onClose: () => void;
  onCreated: (boosterId: string) => void;
}) {
  const { t } = useTranslation();
  const typeLabel = useBoosterTypeLabel(game);
  const languages = game.languages?.length ? game.languages : ["en"];
  const types = boosterTypesFor(game);
  const [sets, setSets] = useState<QuickAddSet[] | null>(null);
  const [setCode, setSetCode] = useState("");
  const [lang, setLang] = useState(languages[0]);
  const [type, setType] = useState(types[0]?.key ?? "other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getQuickAddSets(game.slug)
      .then(({ sets: list }) => {
        if (cancelled) return;
        setSets(list);
        setSetCode((current) => current || list[0]?.setCode || "");
      })
      .catch(() => !cancelled && setSets([]));
    return () => {
      cancelled = true;
    };
  }, [game.slug]);

  function submit() {
    if (!setCode || saving) return;
    setSaving(true);
    setError(null);
    createBooster({ gameSlug: game.slug, setCode, lang, type })
      .then(({ id }) => onCreated(id))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("boosters.errors.generic"));
        setSaving(false);
      });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("boosters.createTitle")}</h2>
          <label className="field">
            <span className="field__label">{t("boosters.set")}</span>
            <select value={setCode} onChange={(e) => setSetCode(e.currentTarget.value)} disabled={!sets}>
              {!sets && <option value="">{t("common.loading")}</option>}
              {sets?.length === 0 && <option value="">{t("boosters.noSet")}</option>}
              {sets?.map((set) => (
                <option key={set.setCode} value={set.setCode}>
                  {set.name ? `${set.name} (${set.setCode})` : set.setCode}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t("boosters.language")}</span>
            <select value={lang} onChange={(e) => setLang(e.currentTarget.value)}>
              {languages.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t("boosters.type")}</span>
            <select value={type} onChange={(e) => setType(e.currentTarget.value)}>
              {types.map((option) => (
                <option key={option.key} value={option.key}>
                  {typeLabel(option.key)}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn btn--grad btn--block" onClick={submit} disabled={!setCode || saving}>
            {saving ? t("common.saving") : t("boosters.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
