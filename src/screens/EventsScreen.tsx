import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listEvents } from "../api/events";
import { BackIcon, ChevronIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";

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

export function EventsScreen() {
  const { t } = useTranslation();
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

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    currentLocale(),
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("events.title")}</h1>
        </div>
      </div>

      <div className="month-nav">
        <button
          className="month-nav__button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("events.prevMonth")}
        >
          <BackIcon size={18} />
        </button>
        <span className="month-nav__label">{monthLabel}</span>
        <button
          className="month-nav__button"
          onClick={() => shiftMonth(1)}
          aria-label={t("events.nextMonth")}
        >
          <ChevronIcon size={18} />
        </button>
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? t("events.empty") : undefined}
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
              {event.status && statusLabelKeys[event.status] ? (
                <span className="chip chip--danger">
                  {t(statusLabelKeys[event.status])}
                </span>
              ) : (
                <span className="chip chip--accent">
                  {t("events.statusOpen")}
                </span>
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
