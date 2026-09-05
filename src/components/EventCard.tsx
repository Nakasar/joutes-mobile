import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toggleEventFavorite } from "../api/events";
import type { JoutesEvent } from "../api/types";
import { StarIcon } from "./icons";
import { currentLocale } from "../i18n";

/**
 * Une carte d'événement : la date en bloc, le nom, le jeu et le lieu, les
 * puces d'état, et l'étoile du favori pour qui a un compte. Servie par
 * l'agenda, la vitrine d'un lieu et l'accueil.
 */
function dow(iso: string): string {
  return new Date(iso)
    .toLocaleDateString(currentLocale(), { weekday: "short" })
    .replace(".", "");
}
function dayNum(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), { day: "numeric" });
}
function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabelKeys: Record<string, string> = {
  "sold-out": "events.statusSoldOut",
  cancelled: "events.statusCancelled",
};

export function EventCard({
  event,
  myUserId,
  onChanged,
}: {
  event: JoutesEvent;
  myUserId: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const isRegistered = !!myUserId && (event.participants ?? []).includes(myUserId);
  const isPreRegistered =
    isRegistered && event.participantRegistrations?.[myUserId ?? ""] === "PRE_REGISTERED";
  const isFavorited = !!myUserId && (event.favoritedBy ?? []).includes(myUserId);

  function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    toggleEventFavorite(event.id)
      .then(onChanged)
      .catch(() => {
        /* silencieux : échoue si non connecté */
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className={`event-card${isRegistered ? " event-card--registered" : ""}`}>
      <Link to={`/events/${event.id}`} className="event-card__link">
        <div className="event-date">
          <span className="event-date__dow">{dow(event.startDateTime)}</span>
          <span className="event-date__day">{dayNum(event.startDateTime)}</span>
          <span className="event-date__time">{time(event.startDateTime)}</span>
        </div>
        <div className="event-card__body">
          <h2 className="event-card__name">{event.name}</h2>
          <p className="event-card__where">
            {[event.game?.name ?? event.gameName, event.lair?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="event-card__meta">
            {isRegistered && (
              <span className="chip chip--accent">
                {t(isPreRegistered ? "events.preRegistered" : "events.registered")}
              </span>
            )}
            {event.status && statusLabelKeys[event.status] ? (
              <span className="chip chip--danger">
                {t(statusLabelKeys[event.status])}
              </span>
            ) : (
              <span className="chip chip--accent">{t("events.statusOpen")}</span>
            )}
            {typeof event.price === "number" && event.price > 0 && (
              <span className="chip">{event.price} €</span>
            )}
            {typeof event.maxParticipants === "number" && (
              <span className="chip">
                {event.registeredParticipantsCount ?? 0}/{event.maxParticipants}
              </span>
            )}
          </p>
        </div>
      </Link>
      {myUserId && (
        <button
          type="button"
          className={`event-card__star${isFavorited ? " event-card__star--on" : ""}`}
          onClick={toggleFavorite}
          disabled={busy}
          aria-label={t(isFavorited ? "events.unfavorite" : "events.favorite")}
          aria-pressed={isFavorited}
        >
          <StarIcon size={18} filled={isFavorited} />
        </button>
      )}
    </div>
  );
}
