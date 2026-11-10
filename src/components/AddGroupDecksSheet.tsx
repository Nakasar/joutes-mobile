import { useState } from "react";
import { useTranslation } from "react-i18next";
import { searchDecks } from "../api/decks";
import { addGroupDecks } from "../api/play-group-game";
import { useApi } from "../hooks/useApi";
import { StatusView } from "./StatusView";

/**
 * « Ajouter mes decks » : mes decks, à cocher. Ceux déjà dans le groupe sont
 * grisés. Le serveur écarte ce que le groupe ne prend pas (jeu non activé,
 * deck méta importé) et le dit : on l'affiche tel quel.
 */
export function AddGroupDecksSheet({
  groupId,
  alreadyIn,
  onClose,
  onAdded,
}: {
  groupId: string;
  alreadyIn: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useApi(() => searchDecks({ scope: "mine", sortBy: "updatedAt", sortOrder: "desc", limit: 100 }), []);

  function toggle(deckId: string) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const outcome = await addGroupDecks(groupId, [...picked]);
      if ((outcome.refused?.length ?? 0) > 0 && outcome.added === 0) {
        setError(t("social.groupDecks.refused", { count: outcome.refused?.length ?? 0 }));
        setSaving(false);
        return;
      }
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  const decks = mine.data?.decks ?? [];

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("social.groupDecks.add")}</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            {t("social.groupDecks.addHint")}
          </p>

          <StatusView
            loading={mine.loading}
            error={mine.error}
            onRetry={mine.reload}
            empty={mine.data && decks.length === 0 ? t("social.groupDecks.noneMine") : undefined}
          />

          <div className="check-list">
            {decks.map((deck) => {
              const inGroup = alreadyIn.has(deck.id);
              return (
                <label key={deck.id} className={`check-row${inGroup ? " check-row--disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={inGroup || picked.has(deck.id)}
                    disabled={inGroup || saving}
                    onChange={() => toggle(deck.id)}
                  />
                  <span className="check-row__body">
                    <span className="check-row__title">{deck.name}</span>
                    <span className="check-row__sub">
                      {inGroup ? t("social.groupDecks.alreadyIn") : deck.legendName || t("decks.noLegend")}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn--grad btn--block" disabled={saving || picked.size === 0} onClick={save}>
            {t("social.groupDecks.addCount", { count: picked.size })}
          </button>
        </div>
      </div>
    </div>
  );
}
