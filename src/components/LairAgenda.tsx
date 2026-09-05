import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEvents } from "../api/events";
import type { JoutesEvent, LairCalendarMode } from "../api/types";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { EventCard } from "./EventCard";
import { Movement } from "./Movement";
import { StatusView } from "./StatusView";
import { ChevronIcon } from "./icons";

/** Les événements groupés par jour, chaque jour dans l'ordre des heures. */
function groupByDay(events: JoutesEvent[]): { day: string; events: JoutesEvent[] }[] {
  const groups = new Map<string, JoutesEvent[]>();
  for (const event of [...events].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))) {
    const date = new Date(event.startDateTime);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, events: list }));
}

function formatDay(key: string, locale: string, long = false): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  });
}

/**
 * L'agenda d'un lieu, dans le mode que le lieu a réglé.
 *
 * `CALENDAR` et `AGENDA` se lisent par mois, groupés par jour — la grille du
 * site tient mal dans la largeur d'un téléphone, et une liste datée dit la
 * même chose. `CONFERENCE` est un programme : quelques jours, beaucoup de
 * créneaux, qu'on parcourt jour par jour.
 */
export function LairAgenda({
  lairId,
  mode,
  yearEvents,
  myUserId,
  onChanged,
}: {
  lairId: string;
  mode: LairCalendarMode;
  /** Les événements de l'année, déjà lus par la vitrine : le programme s'en sert. */
  yearEvents: JoutesEvent[];
  myUserId: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();

  if (mode === "CONFERENCE") {
    return (
      <Programme events={yearEvents} locale={locale} myUserId={myUserId} onChanged={onChanged} />
    );
  }
  return <MonthList lairId={lairId} locale={locale} myUserId={myUserId} onChanged={onChanged} t={t} />;
}

function MonthList({
  lairId,
  locale,
  myUserId,
  onChanged,
  t,
}: {
  lairId: string;
  locale: string;
  myUserId: string | undefined;
  onChanged: () => void;
  t: (key: string) => string;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const events = useApi(
    () => listEvents({ lairId, month: cursor.month, year: cursor.year }),
    [lairId, cursor.month, cursor.year],
  );

  const days = useMemo(() => groupByDay(events.data ?? []), [events.data]);
  const title = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const shift = (delta: number) => {
    setCursor(({ year, month }) => {
      const date = new Date(year, month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  };

  return (
    <section>
      <div className="month-nav">
        <button className="icon-button" onClick={() => shift(-1)} aria-label={t("lairs.portal.agenda.previous")}>
          <ChevronIcon size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
        <h2 className="month-nav__title">{title}</h2>
        <button className="icon-button" onClick={() => shift(1)} aria-label={t("lairs.portal.agenda.next")}>
          <ChevronIcon size={18} />
        </button>
      </div>

      <StatusView
        loading={events.loading}
        error={events.error}
        onRetry={events.reload}
        empty={events.data && days.length === 0 ? t("lairs.portal.agenda.emptyMonth") : undefined}
      />

      {days.map(({ day, events: list }) => (
        <div key={day} className="lair-agenda-day">
          <Movement section title={formatDay(day, locale)} />
          {list.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              myUserId={myUserId}
              onChanged={() => {
                events.reload();
                onChanged();
              }}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function Programme({
  events,
  locale,
  myUserId,
  onChanged,
}: {
  events: JoutesEvent[];
  locale: string;
  myUserId: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const days = useMemo(() => groupByDay(events), [events]);
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const current =
    days.find((entry) => entry.day === selected) ??
    days.find((entry) => entry.day >= todayKey) ??
    days[days.length - 1];

  if (days.length === 0) {
    return <StatusView empty={t("lairs.agenda.empty")} />;
  }

  return (
    <section>
      <div className="chip-row">
        {days.map(({ day, events: list }) => (
          <button
            key={day}
            className={`chip-filter${current?.day === day ? " chip-filter--active" : ""}`}
            onClick={() => setSelected(day)}
          >
            {formatDay(day, locale)} · {list.length}
          </button>
        ))}
      </div>
      {current && (
        <>
          <Movement section title={formatDay(current.day, locale, true)} />
          {current.events.map((event) => (
            <EventCard key={event.id} event={event} myUserId={myUserId} onChanged={onChanged} />
          ))}
        </>
      )}
    </section>
  );
}
