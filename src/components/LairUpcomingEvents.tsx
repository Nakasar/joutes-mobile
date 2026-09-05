import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { JoutesEvent } from "../api/types";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { EventCard } from "./EventCard";
import { Movement } from "./Movement";

const SCOPES = ["mine", "all"] as const;
type Scope = (typeof SCOPES)[number];

/**
 * Les prochains événements du lieu, avec la bascule « Mes jeux / Tous ».
 *
 * Le filtre se fait ici, les événements étant déjà là, et il se joint par
 * **nom de jeu** : un événement moissonné ne porte que `gameName`. Il démarre
 * sur « Mes jeux » dès que le visiteur suit un des jeux du lieu — le cadrage
 * d'un habitué — et dit toujours combien d'événements il écarte, pour qu'un
 * filtre ne passe jamais pour un lieu sans programme.
 */
export function LairUpcomingEvents({
  events,
  followedGameNames,
  myUserId,
  limit = 5,
  onChanged,
  onSeeAgenda,
}: {
  events: JoutesEvent[];
  followedGameNames: string[];
  myUserId: string | undefined;
  limit?: number;
  onChanged: () => void;
  onSeeAgenda: () => void;
}) {
  const { t } = useTranslation();
  const canFilter = followedGameNames.length > 0;
  const [requested, setScope] = useSearchParamState<Scope>("scope", SCOPES, "mine");
  const scope: Scope = canFilter ? requested : "all";

  const mine = useMemo(
    () =>
      events.filter((event) =>
        followedGameNames.includes(event.gameName ?? event.game?.name ?? ""),
      ),
    [events, followedGameNames],
  );
  const visible = scope === "mine" ? mine : events;
  const hidden = events.length - mine.length;

  return (
    <section className="lair-upcoming">
      <Movement
        section
        title={t("lairs.portal.upcoming.title")}
        aside={t("lairs.portal.upcoming.count", { count: visible.length })}
      />

      {canFilter && (
        <div className="segmented" style={{ marginBottom: 10 }}>
          {SCOPES.map((value) => (
            <button
              key={value}
              className={`segmented__item${scope === value ? " segmented__item--active" : ""}`}
              onClick={() => setScope(value)}
            >
              {t(value === "mine" ? "lairs.portal.upcoming.scopeMine" : "lairs.portal.upcoming.scopeAll")}
            </button>
          ))}
        </div>
      )}

      {scope === "mine" && canFilter && hidden > 0 && (
        <p className="muted lair-upcoming__note">
          {t("lairs.portal.upcoming.hidden", { count: hidden })}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="status muted">{t("lairs.agenda.empty")}</p>
      ) : (
        visible
          .slice(0, limit)
          .map((event) => (
            <EventCard key={event.id} event={event} myUserId={myUserId} onChanged={onChanged} />
          ))
      )}

      {visible.length > limit && (
        <button className="btn btn--outline btn--block" onClick={onSeeAgenda}>
          {t("lairs.portal.upcoming.seeAgenda")}
        </button>
      )}
    </section>
  );
}
