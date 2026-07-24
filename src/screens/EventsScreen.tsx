import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listEvents, toggleEventFavorite } from "../api/events";
import type { JoutesEvent } from "../api/types";
import { StarIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { useAuth } from "../store/auth";

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

function EventCard({
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
    </div>
  );
}

function sortAscending(events: JoutesEvent[]): JoutesEvent[] {
  return [...events].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}
function sortDescending(events: JoutesEvent[]): JoutesEvent[] {
  return [...events].sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));
}

export function EventsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [now] = useState(() => new Date().toISOString());
  const [showPast, setShowPast] = useState(false);

  const upcoming = useApi(() => listEvents({ afterDate: now }), [now]);
  const past = useApi(
    () => (showPast ? listEvents({ beforeDate: now }) : Promise.resolve([])),
    [showPast, now],
  );

  function reloadAll() {
    upcoming.reload();
    if (showPast) past.reload();
  }

  const upcomingEvents = sortAscending(upcoming.data ?? []);
  const pastEvents = sortDescending(past.data ?? []);

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("events.title")}</h1>
        </div>
      </div>

      <StatusView
        loading={upcoming.loading}
        error={upcoming.error}
        onRetry={upcoming.reload}
        empty={upcoming.data?.length === 0 ? t("events.empty") : undefined}
      />

      {upcomingEvents.map((event) => (
        <EventCard key={event.id} event={event} myUserId={user?.id} onChanged={reloadAll} />
      ))}

      {!showPast ? (
        <button
          className="btn btn--outline btn--block"
          style={{ marginTop: 12 }}
          onClick={() => setShowPast(true)}
        >
          {t("events.loadPast")}
        </button>
      ) : (
        <>
          <p className="section-label" style={{ marginTop: 16 }}>
            {t("events.pastTitle")}
          </p>
          <StatusView
            loading={past.loading}
            error={past.error}
            onRetry={past.reload}
            empty={past.data?.length === 0 ? t("events.emptyPast") : undefined}
          />
          {pastEvents.map((event) => (
            <EventCard key={event.id} event={event} myUserId={user?.id} onChanged={reloadAll} />
          ))}
        </>
      )}
    </div>
  );
}
