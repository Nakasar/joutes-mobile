import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPlayGroupSession } from "../api/play-groups";
import type { PlayGroupSession } from "../api/types";
import { PlusIcon, TrashIcon } from "./icons";

/** Autant de créneaux que le serveur en accepte — au-delà, ce n'est plus un sondage. */
const MAX_SLOTS = 8;

/**
 * Proposer une soirée : une date ferme, ou des créneaux à sonder.
 *
 * Un seul formulaire pour les deux, parce que c'est un seul objet côté serveur.
 * Le choix se fait en tête, et il change ce qu'on demande : une date, ou une
 * liste. Demander les deux à la fois donnerait un formulaire dont la moitié est
 * toujours inutile.
 *
 * Les créneaux se saisissent avec un `datetime-local`, qui rend une heure
 * **locale sans fuseau** : elle est convertie en ISO avant l'envoi, faute de
 * quoi le serveur lirait 20h comme 20h UTC — soit 22h à Paris en été.
 */
export function CreateSessionSheet({
  playGroupId,
  onClose,
  onCreated,
}: {
  playGroupId: string;
  onClose: () => void;
  onCreated: (session: PlayGroupSession) => void;
}) {
  const { t } = useTranslation();

  const [poll, setPoll] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledSlots = slots.map((slot) => slot.trim()).filter(Boolean);
  const ready = title.trim().length > 0 && (poll ? filledSlots.length >= 2 : !!startsAt);

  /** Une saisie locale « 2026-08-27T20:00 » en instant ISO. */
  function toIso(local: string): string {
    return new Date(local).toISOString();
  }

  async function submit() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const session = await createPlayGroupSession(playGroupId, {
        title: title.trim(),
        place: placeLabel.trim() ? { kind: "free", label: placeLabel.trim() } : undefined,
        ...(poll
          ? { slots: filledSlots.map((slot) => ({ startsAt: toIso(slot) })) }
          : { startsAt: toIso(startsAt) }),
      });
      onCreated(session);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("social.sessions.create.title")}</h2>

          <div className="segmented" style={{ marginBottom: 14 }}>
            <button
              className={`segmented__item${poll ? "" : " segmented__item--active"}`}
              onClick={() => setPoll(false)}
            >
              {t("social.sessions.create.fixed")}
            </button>
            <button
              className={`segmented__item${poll ? " segmented__item--active" : ""}`}
              onClick={() => setPoll(true)}
            >
              {t("social.sessions.create.poll")}
            </button>
          </div>

          <label className="field">
            <span className="field__label">{t("social.sessions.create.name")}</span>
            <input
              type="text"
              value={title}
              maxLength={140}
              placeholder={t("social.sessions.create.namePlaceholder")}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
          </label>

          {poll ? (
            <>
              <p className="field__label">{t("social.sessions.create.slots")}</p>
              {slots.map((slot, index) => (
                <div key={index} className="session-slot-input">
                  <input
                    type="datetime-local"
                    value={slot}
                    onChange={(e) => {
                      const next = [...slots];
                      next[index] = e.currentTarget.value;
                      setSlots(next);
                    }}
                  />
                  {/* Deux créneaux au minimum : en dessous, ce n'est plus un
                      sondage mais une date, et l'autre onglet la propose. */}
                  {slots.length > 2 && (
                    <button
                      className="icon-button"
                      aria-label={t("common.delete")}
                      onClick={() => setSlots(slots.filter((_, i) => i !== index))}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              ))}
              {slots.length < MAX_SLOTS && (
                <button
                  className="btn btn--outline btn--block"
                  onClick={() => setSlots([...slots, ""])}
                >
                  <PlusIcon size={16} />
                  {t("social.sessions.create.addSlot")}
                </button>
              )}
            </>
          ) : (
            <label className="field">
              <span className="field__label">{t("social.sessions.create.when")}</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.currentTarget.value)}
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">{t("social.sessions.create.place")}</span>
            <input
              type="text"
              value={placeLabel}
              maxLength={120}
              placeholder={t("social.sessions.create.placePlaceholder")}
              onChange={(e) => setPlaceLabel(e.currentTarget.value)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            disabled={!ready || saving}
            onClick={submit}
          >
            {t("social.sessions.create.submit")}
          </button>
          <button className="btn btn--ghost btn--block" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
