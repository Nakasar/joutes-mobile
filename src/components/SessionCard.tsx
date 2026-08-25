import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  confirmPlayGroupSlot,
  setPlayGroupRsvp,
  votePlayGroupSlot,
} from "../api/play-groups";
import type { PlayGroupRsvpAnswer, PlayGroupSession } from "../api/types";
import { currentLocale } from "../i18n";
import { CheckIcon, PinIcon, UsersIcon } from "./icons";

const ANSWERS: PlayGroupRsvpAnswer[] = ["yes", "maybe", "no"];

function formatMoment(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Une session du groupe : un sondage à remplir, ou une date à laquelle répondre.
 *
 * Les deux vivent dans la même carte parce que c'est le même objet — un sondage
 * tranché *devient* la session, sans changer d'identité ni perdre les
 * disponibilités déjà exprimées.
 *
 * **Rien d'optimiste ici.** Ailleurs (suivre un joueur, un lieu) l'état bascule
 * à la touche parce qu'il n'engage que celui qui touche. Un vote et une réponse
 * de présence engagent une soirée à plusieurs : afficher « inscrit » avant que
 * le serveur l'ait enregistré, c'est risquer que deux personnes croient venir
 * quand une seule est attendue. La carte attend la réponse, et se redessine
 * avec ce que le serveur a réellement retenu.
 */
export function SessionCard({
  session,
  playGroupId,
  userId,
  canManage,
  onChanged,
}: {
  session: PlayGroupSession;
  playGroupId: string;
  userId: string | null;
  canManage: boolean;
  onChanged: (session: PlayGroupSession) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = session.rsvps.find((rsvp) => rsvp.userId === userId)?.answer;
  const yesCount = session.rsvps.filter((rsvp) => rsvp.answer === "yes").length;

  async function run(action: () => Promise<PlayGroupSession>) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const place = session.place?.label || session.place?.detail;

  return (
    <article
      className={`card session-card${session.status === "cancelled" ? " session-card--cancelled" : ""}`}
    >
      <div className="session-card__head">
        <h3 className="session-card__title">{session.title}</h3>
        {session.status === "poll" && (
          <span className="chip chip--accent">{t("social.sessions.poll")}</span>
        )}
        {session.status === "cancelled" && (
          <span className="chip chip--danger">{t("social.sessions.cancelled")}</span>
        )}
      </div>

      {session.startsAt && (
        <p className="session-card__when">{formatMoment(session.startsAt, locale)}</p>
      )}
      {place && (
        <p className="session-card__where">
          <PinIcon size={13} />
          {place}
        </p>
      )}

      {session.status === "poll" && (
        <ul className="session-slots">
          {(session.slots ?? []).map((slot) => {
            const voted = userId ? slot.voterIds.includes(userId) : false;
            return (
              <li key={slot.id} className="session-slot">
                <button
                  className={`chip-filter${voted ? " chip-filter--active" : ""}`}
                  disabled={busy || !userId}
                  aria-pressed={voted}
                  onClick={() => run(() => votePlayGroupSlot(playGroupId, session.id, slot.id))}
                >
                  {formatMoment(slot.startsAt, locale)}
                </button>
                <span className="session-slot__count">
                  <UsersIcon size={13} />
                  {slot.voterIds.length}
                </span>
                {/* Trancher engage tout le groupe : le bouton n'existe que
                    pour ceux qui en ont le droit, plutôt que d'échouer en 403. */}
                {canManage && (
                  <button
                    className="btn btn--outline session-slot__confirm"
                    disabled={busy}
                    onClick={() =>
                      run(() => confirmPlayGroupSlot(playGroupId, session.id, slot.id))
                    }
                  >
                    <CheckIcon size={14} />
                    {t("social.sessions.confirmSlot")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {session.status === "confirmed" && (
        <>
          <p className="session-card__count">
            <UsersIcon size={13} />
            {t("social.sessions.attending", { count: yesCount })}
          </p>
          <div className="chip-set session-card__answers">
            {ANSWERS.map((answer) => (
              <button
                key={answer}
                className={`chip-filter${mine === answer ? " chip-filter--active" : ""}`}
                disabled={busy || !userId}
                aria-pressed={mine === answer}
                onClick={() => run(() => setPlayGroupRsvp(playGroupId, session.id, answer))}
              >
                {t(`social.sessions.answer.${answer}`)}
              </button>
            ))}
          </div>
          {/* Redonner la même réponse l'annule : le dire évite qu'on prenne le
              bouton pour un raté. */}
          {mine && <p className="session-card__hint">{t("social.sessions.answerHint")}</p>}
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </article>
  );
}
