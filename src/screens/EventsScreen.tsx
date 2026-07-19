import { useState } from "react";
import { listEvents } from "../api/events";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
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
      <header className="screen__header">
        <h1>Événements</h1>
      </header>
      <div className="month-nav">
        <button onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
          ←
        </button>
        <span className="month-nav__label">{monthLabel}</span>
        <button onClick={() => shiftMonth(1)} aria-label="Mois suivant">
          →
        </button>
      </div>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? "Aucun événement ce mois-ci." : undefined}
      />
      {data?.map((event) => (
        <div key={event.id} className="card event-card">
          <div className="event-card__date">
            <span>{formatEventDate(event.startDateTime)}</span>
            <span className="muted">{formatTime(event.startDateTime)}</span>
          </div>
          <div className="event-card__body">
            <h2>{event.name}</h2>
            <p className="muted">
              {[event.game?.name ?? event.gameName, event.lair?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="event-card__meta">
              {event.status && statusLabels[event.status] && (
                <span className="chip chip--warning">
                  {statusLabels[event.status]}
                </span>
              )}
              {typeof event.price === "number" && event.price > 0 && (
                <span className="chip">{event.price} €</span>
              )}
              {typeof event.maxParticipants === "number" && (
                <span className="chip">
                  {event.registeredParticipantsCount ?? 0}/{event.maxParticipants}{" "}
                  joueurs
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
