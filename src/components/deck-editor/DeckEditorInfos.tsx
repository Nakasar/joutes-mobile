import { useTranslation } from "react-i18next";
import { DECK_VISIBILITIES } from "../../api/types";
import type { DeckGuideSection, DeckMatchup, DeckMatchupRating, DeckVisibility } from "../../api/types";
import { PlusIcon, TrashIcon } from "../icons";

const MATCHUP_RATINGS: DeckMatchupRating[] = ["favorable", "even", "unfavorable"];

/**
 * L'onglet « Infos » : ce que l'éditeur du site laisse à d'autres écrans et que
 * l'app édite ici — visibilité, format, description, guide de jeu,
 * confrontations et notes privées.
 *
 * La visibilité s'enregistre aussitôt, comme sur le site ; le reste part avec
 * « Enregistrer ».
 */
export function DeckEditorInfos({
  visibility,
  visibilitySaving,
  visibilityError,
  onVisibility,
  format,
  onFormat,
  description,
  onDescription,
  guide,
  onGuide,
  matchups,
  onMatchups,
  notes,
  onNotes,
}: {
  visibility?: DeckVisibility;
  visibilitySaving: boolean;
  visibilityError: string | null;
  onVisibility: (visibility: DeckVisibility) => void;
  format: string;
  onFormat: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  guide: DeckGuideSection[];
  onGuide: (update: (current: DeckGuideSection[]) => DeckGuideSection[]) => void;
  matchups: DeckMatchup[];
  onMatchups: (update: (current: DeckMatchup[]) => DeckMatchup[]) => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const { t } = useTranslation();
  const current = visibility ?? "private";

  return (
    <div className="deck-editor__body">
      <div className="deck-infos__section">
        <span className="field__label">{t("decks.visibility.action")}</span>
        <div className="segmented" role="radiogroup" aria-label={t("decks.visibility.action")}>
          {DECK_VISIBILITIES.map((value) => (
            <button
              key={value}
              role="radio"
              aria-checked={current === value}
              disabled={visibilitySaving}
              className={`segmented__item${current === value ? " segmented__item--active" : ""}`}
              onClick={() => onVisibility(value)}
            >
              {t(`decks.visibility.${value}.label`)}
            </button>
          ))}
        </div>
        <p className="deck-infos__hint">
          {t(`decks.visibility.${current}.hint`)} · {t("decks.editor.infos.visibilityNow")}
        </p>
        {visibilityError && <p className="form-error">{visibilityError}</p>}
      </div>

      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">{t("decks.edit.format")}</span>
        <input
          value={format}
          maxLength={80}
          placeholder={t("decks.edit.formatPlaceholder")}
          onChange={(e) => onFormat(e.currentTarget.value)}
        />
      </label>

      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">{t("decks.edit.description")}</span>
        <textarea
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(e) => onDescription(e.currentTarget.value)}
        />
      </label>

      <div className="deck-infos__section">
        <p className="section-label">{t("decks.guide")}</p>
        {guide.map((section, index) => (
          <div key={index} className="card deck-guide-section">
            <input
              value={section.title}
              maxLength={120}
              placeholder={t("decks.edit.sectionTitle")}
              aria-label={t("decks.edit.sectionTitle")}
              onChange={(e) => {
                const value = e.currentTarget.value;
                onGuide((list) => list.map((item, i) => (i === index ? { ...item, title: value } : item)));
              }}
            />
            <textarea
              value={section.body}
              maxLength={4000}
              rows={4}
              placeholder={t("decks.edit.sectionBody")}
              aria-label={t("decks.edit.sectionBody")}
              onChange={(e) => {
                const value = e.currentTarget.value;
                onGuide((list) => list.map((item, i) => (i === index ? { ...item, body: value } : item)));
              }}
            />
            <button
              className="btn btn--outline"
              onClick={() => onGuide((list) => list.filter((_, i) => i !== index))}
            >
              <TrashIcon size={14} />
              {t("common.remove")}
            </button>
          </div>
        ))}
        <button
          className="deck-edit-zone__add"
          style={{ marginTop: 0 }}
          disabled={guide.length >= 20}
          onClick={() => onGuide((list) => [...list, { title: "", body: "" }])}
        >
          <PlusIcon size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {t("decks.edit.addSection")}
        </button>
      </div>

      <div className="deck-infos__section">
        <p className="section-label">{t("decks.matchups")}</p>
        {matchups.map((matchup, index) => (
          <div key={index} className="card deck-matchup-edit">
            <input
              value={matchup.name}
              maxLength={120}
              placeholder={t("decks.edit.matchupName")}
              aria-label={t("decks.edit.matchupName")}
              onChange={(e) => {
                const value = e.currentTarget.value;
                onMatchups((list) => list.map((item, i) => (i === index ? { ...item, name: value } : item)));
              }}
            />
            <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 0 }}>
              {MATCHUP_RATINGS.map((rating) => (
                <button
                  key={rating}
                  className={`chip-filter${matchup.rating === rating ? " chip-filter--active" : ""}`}
                  aria-pressed={matchup.rating === rating}
                  onClick={() =>
                    onMatchups((list) => list.map((item, i) => (i === index ? { ...item, rating } : item)))
                  }
                >
                  {t(`decks.matchup.${rating}`)}
                </button>
              ))}
              <button
                className="btn btn--outline"
                aria-label={t("common.remove")}
                onClick={() => onMatchups((list) => list.filter((_, i) => i !== index))}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          className="deck-edit-zone__add"
          style={{ marginTop: 0 }}
          disabled={matchups.length >= 40}
          onClick={() => onMatchups((list) => [...list, { name: "", rating: "even" }])}
        >
          <PlusIcon size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {t("decks.edit.addMatchup")}
        </button>
      </div>

      <label className="field" style={{ margin: 0 }}>
        <span className="field__label">{t("decks.notes")}</span>
        <textarea
          value={notes}
          maxLength={4000}
          rows={3}
          placeholder={t("decks.edit.notesPlaceholder")}
          onChange={(e) => onNotes(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
