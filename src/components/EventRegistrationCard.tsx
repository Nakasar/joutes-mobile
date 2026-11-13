import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { registerToEvent, unregisterFromEvent } from "../api/events";
import type { JoutesEvent } from "../api/types";

interface EventRegistrationCardProps {
  event: JoutesEvent;
  /** Identifiant de la personne connectée ; absent hors connexion. */
  userId?: string;
  /** Relit l'évènement une fois l'inscription modifiée. */
  onChange: () => void;
}

/**
 * S'inscrire à un évènement, ou s'en désinscrire, comme sur la fiche du site
 * (`POST`/`DELETE /events/{id}/registration`).
 *
 * Ne s'affiche que lorsque c'est possible : inscriptions ouvertes, évènement
 * pas commencé. Complet, c'est la carte de la liste d'attente qui prend le
 * relais. Se désinscrire se confirme d'un second toucher : la place part au
 * premier de la file.
 */
export function EventRegistrationCard({ event, userId, onChange }: EventRegistrationCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notStarted = !event.runningState || event.runningState === "not-started";
  const cancelled = event.status === "cancelled";
  const isRegistered = !!userId && (event.participants ?? []).includes(userId);
  const onWaitlist = !!event.viewerWaitlist;

  if (!notStarted || cancelled || onWaitlist) return null;

  function run(action: (eventId: string) => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError(null);
    action(event.id)
      .then(() => {
        setConfirming(false);
        onChange();
      })
      .catch((err: unknown) => {
        // 409 : l'évènement a changé depuis l'affichage (complet, déjà
        // inscrit, inscriptions fermées). On le relit : complet, la carte
        // laisse place à celle de la liste d'attente.
        const full = err instanceof ApiError && (err.body as { full?: boolean } | undefined)?.full === true;
        setError(t(full ? "events.registration.full" : "events.registration.error"));
        if (err instanceof ApiError && err.status === 409) onChange();
      })
      .finally(() => setPending(false));
  }

  if (isRegistered) {
    const pre = event.participantRegistrations?.[userId ?? ""] === "PRE_REGISTERED";
    return (
      <section className="card waitlist-card" aria-labelledby="registration-title">
        <h2 id="registration-title" className="card__title waitlist-card__title">
          {t(pre ? "events.registration.preRegisteredTitle" : "events.registration.registeredTitle")}
        </h2>
        <p className="list-meta">
          {t(pre ? "events.registration.preRegisteredText" : "events.registration.registeredText")}
        </p>
        {error && <p className="form-error">{error}</p>}
        {confirming ? (
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={pending}
            onClick={() => run(unregisterFromEvent)}
          >
            {pending ? t("events.waitlist.loading") : t("events.registration.leaveConfirm")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--outline btn--block"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {t("events.registration.leave")}
          </button>
        )}
      </section>
    );
  }

  // Complet ou des joueurs attendent déjà : la liste d'attente s'en charge.
  if (event.allowJoin !== true || event.canJoinDirectly === false) return null;

  if (!userId) {
    return (
      <section className="card waitlist-card" aria-labelledby="registration-title">
        <h2 id="registration-title" className="card__title waitlist-card__title">
          {t("events.registration.openTitle")}
        </h2>
        <p className="list-meta">{t("events.registration.signInText")}</p>
        <button type="button" className="btn btn--grad btn--block" onClick={() => navigate("/login")}>
          {t("common.signIn")}
        </button>
      </section>
    );
  }

  return (
    <section className="card waitlist-card" aria-labelledby="registration-title">
      <h2 id="registration-title" className="card__title waitlist-card__title">
        {t("events.registration.openTitle")}
      </h2>
      <p className="list-meta">
        {t(event.preRegistration ? "events.registration.preRegistrationText" : "events.registration.openText")}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className="btn btn--grad btn--block"
        disabled={pending}
        onClick={() => run(registerToEvent)}
      >
        {pending
          ? t("events.waitlist.loading")
          : t(event.preRegistration ? "events.registration.preRegister" : "events.registration.register")}
      </button>
    </section>
  );
}
