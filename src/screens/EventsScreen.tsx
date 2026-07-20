import { useState } from "react";
import { listEvents } from "../api/events";
import { BackIcon, ChevronIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

function dow(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("fr-FR", { weekday: "short" })
    .replace(".", "");
}
function dayNum(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric" });
}
function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabels: Record<string, string> = {
  "sold-out": "Complet",
  cancelled: "Annulé",
};

export function EventsScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, loading, error, reload } = useApi(
    () => listEvents({ month, year }),
    [month, year],
  );

  function shiftMonth(delta: number) {
    const date = new Date(year, month - 1 + delta, 1);
    setMonth(date.getMonth() + 1);
    setYear(date.getFullYear());
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">Événements</h1>
        </div>
      </div>

      <div className="month-nav">
        <button
          className="month-nav__button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
        >
          <BackIcon size={18} />
        </button>
        <span className="month-nav__label">{monthLabel}</span>
        <button
          className="month-nav__button"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
        >
          <ChevronIcon size={18} />
        </button>
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? "Aucun événement ce mois-ci." : undefined}
      />

      {data?.map((event) => (
        <div key={event.id} className="event-card">
          <div className="event-date">
            <span className="event-date__dow">{dow(event.startDateTime)}</span>
            <span className="event-date__day">
              {dayNum(event.startDateTime)}
            </span>
            <span className="event-date__time">
              {time(event.startDateTime)}
            </span>
          </div>
          <div className="event-card__body">
            <h2 className="event-card__name">{event.name}</h2>
            <p className="event-card__where">
              {[event.game?.name ?? event.gameName, event.lair?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="event-card__meta">
              {event.status && statusLabels[event.status] ? (
                <span className="chip chip--danger">
                  {statusLabels[event.status]}
                </span>
              ) : (
                <span className="chip chip--accent">Ouvert</span>
              )}
              {typeof event.price === "number" && event.price > 0 && (
                <span className="chip">{event.price} €</span>
              )}
              {typeof event.maxParticipants === "number" && (
                <span className="chip">
                  {event.registeredParticipantsCount ?? 0}/
                  {event.maxParticipants}
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
