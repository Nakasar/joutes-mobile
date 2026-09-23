import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  acceptEventWaitlistOffer,
  declineEventWaitlistOffer,
  joinEventWaitlist,
  leaveEventWaitlist,
} from "../api/events";
import type { JoutesEvent } from "../api/types";
import { currentLocale } from "../i18n";
import { ClockIcon } from "./icons";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** « 23 h 41 » : ce qu'il reste avant l'échéance d'une offre. */
function formatRemaining(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((Date.parse(iso) - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`;
}

type Pending = "join" | "leave" | "accept" | "decline";

interface EventWaitlistCardProps {
  event: JoutesEvent;
  isParticipant: boolean;
  /** Relit l'évènement une fois la file modifiée. */
  onChange: () => void;
}

/**
 * La liste d'attente d'un évènement complet, vue par la personne connectée :
 * la rejoindre, y lire sa position, et surtout répondre à l'offre d'une place
 * libérée — c'est ici que mène la notification « Une place s'est libérée ».
 *
 * Quitter la file et décliner une offre se confirment d'un second toucher :
 * l'une comme l'autre font perdre sa place, sans retour possible.
 */
export function EventWaitlistCard({ event, isParticipant, onChange }: EventWaitlistCardProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState<"leave" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = event.viewerWaitlist ?? null;
  const canJoin =
    !isParticipant &&
    !status &&
    event.waitlistOpen === true &&
    event.canJoinDirectly === false;

  if (!status && !canJoin) return null;

  function run(kind: Pending, action: (eventId: string) => Promise<unknown>) {
    if (pending) return;
    setPending(kind);
    setError(null);
    action(event.id)
      .then(() => {
        setConfirming(null);
        onChange();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("events.waitlist.error"));
      })
      .finally(() => setPending(null));
  }

  if (status?.offer) {
    const { expiresAt } = status.offer;
    return (
      <section className="card waitlist-card waitlist-card--offer" aria-labelledby="waitlist-offer-title">
        <span className="chip chip--warning">{t("events.waitlist.yourTurn")}</span>
        <h2 id="waitlist-offer-title" className="card__title waitlist-card__title">
          {t("events.waitlist.offerTitle")}
        </h2>
        <p className="list-meta">
          {t("events.waitlist.offerText", { date: formatDateTime(expiresAt) })}
        </p>
        <p className="waitlist-card__remaining">
          <ClockIcon size={16} />
          {t("events.waitlist.remaining", { time: formatRemaining(expiresAt, Date.now()) })}
        </p>
        {error && <p className="form-error">{error}</p>}
        <button
          type="button"
          className="btn btn--grad btn--block"
          disabled={pending !== null}
          onClick={() => run("accept", acceptEventWaitlistOffer)}
        >
          {pending === "accept" ? t("events.waitlist.loading") : t("events.waitlist.accept")}
        </button>
        {confirming === "decline" ? (
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={pending !== null}
            onClick={() => run("decline", declineEventWaitlistOffer)}
          >
            {pending === "decline" ? t("events.waitlist.loading") : t("events.waitlist.declineConfirm")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--block waitlist-card__decline"
            disabled={pending !== null}
            onClick={() => setConfirming("decline")}
          >
            {t("events.waitlist.decline")}
          </button>
        )}
        <p className="list-meta waitlist-card__note">{t("events.waitlist.offerNote")}</p>
      </section>
    );
  }

  if (status) {
    return (
      <section className="card waitlist-card" aria-labelledby="waitlist-title">
        <div className="waitlist-card__head">
          <div className="waitlist-card__rank" aria-hidden="true">
            <strong>{status.position}</strong>
            <span>{t("events.waitlist.outOf", { total: status.total })}</span>
          </div>
          <div>
            <h2 id="waitlist-title" className="card__title waitlist-card__title">
              {t("events.waitlist.onList")}
            </h2>
            <p className="list-meta">
              {t("events.waitlist.since", { date: formatDateTime(status.joinedAt) })}
            </p>
          </div>
        </div>
        <p className="list-meta">{t("events.waitlist.explanation")}</p>
        {error && <p className="form-error">{error}</p>}
        {confirming === "leave" ? (
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={pending !== null}
            onClick={() => run("leave", leaveEventWaitlist)}
          >
            {pending === "leave" ? t("events.waitlist.loading") : t("events.waitlist.leaveConfirm")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--outline btn--block"
            disabled={pending !== null}
            onClick={() => setConfirming("leave")}
          >
            {t("events.waitlist.leave")}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card waitlist-card" aria-labelledby="waitlist-join-title">
      <h2 id="waitlist-join-title" className="card__title">
        {t("events.waitlist.fullTitle")}
      </h2>
      <p className="list-meta">{t("events.waitlist.fullText")}</p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className="btn btn--grad btn--block"
        disabled={pending !== null}
        onClick={() => run("join", joinEventWaitlist)}
      >
        {pending === "join" ? t("events.waitlist.loading") : t("events.waitlist.join")}
      </button>
      <p className="list-meta waitlist-card__note">
        {t("events.waitlist.wouldBe", { position: (event.waitlistCount ?? 0) + 1 })}
      </p>
    </section>
  );
}
