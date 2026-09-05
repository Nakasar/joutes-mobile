import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listEvents, toggleEventFavorite } from "../api/events";
import { listGames } from "../api/games";
import { getMyGames } from "../api/users";
import type { JoutesEvent } from "../api/types";
import { LocationSheet } from "../components/LocationSheet";
import { PlacePill } from "../components/PlacePill";
import { PinIcon, StarIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useSavedPlace } from "../hooks/useSavedPlace";
import { useSearchParam, useSearchParamState } from "../hooks/useSearchParamState";
import { currentLocale } from "../i18n";
import { PLACE_RADII, placeName } from "../lib/saved-place";
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

function sortAscending(events: JoutesEvent[]): JoutesEvent[] {
  return [...events].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}
function sortDescending(events: JoutesEvent[]): JoutesEvent[] {
  return [...events].sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));
}

const MODES = ["mine", "near"] as const;
type Mode = (typeof MODES)[number];

/**
 * L'agenda.
 *
 * Deux lectures : **mes lieux** — ce que l'API sait croiser pour un compte,
 * lieux suivis, jeux suivis, inscriptions et favoris — et **autour de moi**,
 * pour qui a dit sa ville (`src/lib/saved-place.ts`). Un visiteur n'a que la
 * seconde : sans ville, l'API ne rend rien, et l'écran lui demande donc où il
 * est plutôt que de lui montrer une liste vide.
 *
 * Le jeu se choisit en puce parmi ceux qu'on suit ; un visiteur les a tous.
 * Liste des prochains, comme avant — le calendrier par mois reste au site.
 */
export function EventsScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { place, save, clear } = useSavedPlace();

  const [requestedMode, setMode] = useSearchParamState<Mode>(
    "mode",
    MODES,
    isAuthenticated ? "mine" : "near",
  );
  const mode: Mode = isAuthenticated ? requestedMode : "near";
  const [gameId, setGameId] = useSearchParam("game");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now] = useState(() => new Date().toISOString());
  const [showPast, setShowPast] = useState(false);

  const myGames = useApi(
    () => (isAuthenticated ? getMyGames() : Promise.resolve(null)),
    [isAuthenticated],
  );
  const catalog = useApi(() => (isAuthenticated ? Promise.resolve(null) : listGames()), [
    isAuthenticated,
  ]);
  const gameChips = useMemo(() => {
    if (isAuthenticated) {
      return (myGames.data?.games ?? []).map((game) => ({ id: game.id, name: game.name }));
    }
    return (catalog.data ?? []).map((game) => ({ id: game._id, name: game.name }));
  }, [isAuthenticated, myGames.data, catalog.data]);

  const near = mode === "near" ? place : null;
  const ready = mode === "mine" || near !== null;
  const nearParams = near
    ? { userLat: near.latitude, userLon: near.longitude, maxDistance: near.radiusKm }
    : {};
  const nearKey = near ? `${near.latitude}|${near.longitude}|${near.radiusKm}` : "";

  const upcoming = useApi(
    () =>
      ready
        ? listEvents({ afterDate: now, ...(gameId ? { gameId } : {}), ...nearParams })
        : Promise.resolve([]),
    [ready, now, gameId, nearKey, mode],
  );
  const past = useApi(
    () =>
      ready && showPast
        ? listEvents({ beforeDate: now, ...(gameId ? { gameId } : {}), ...nearParams })
        : Promise.resolve([]),
    [ready, showPast, now, gameId, nearKey, mode],
  );

  function reloadAll() {
    upcoming.reload();
    if (showPast) past.reload();
  }

  // Filet : tant que la production n'honore pas `afterDate` sur la branche
  // anonyme géolocalisée, on trie ici ce qui est passé.
  const upcomingEvents = sortAscending(
    (upcoming.data ?? []).filter((event) => event.startDateTime >= now),
  );
  const pastEvents = sortDescending(
    (past.data ?? []).filter((event) => event.startDateTime < now),
  );

  const nextRadius = near ? PLACE_RADII.find((value) => value > near.radiusKm) : undefined;

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("events.title")}</h1>
        </div>
        {/* Les événements se tiennent quelque part : l'annuaire des lieux
            s'ouvre d'ici, où l'on se demande justement où aller. */}
        <div className="head-actions">
          <Link
            to="/lairs"
            className="icon-button icon-button--primary"
            aria-label={t("lairs.title")}
          >
            <PinIcon size={20} />
          </Link>
        </div>
      </div>

      {isAuthenticated && (
        <div className="segmented" style={{ marginBottom: 12 }}>
          <button
            className={`segmented__item${mode === "mine" ? " segmented__item--active" : ""}`}
            onClick={() => setMode("mine")}
          >
            {t("events.mode.mine")}
          </button>
          <button
            className={`segmented__item${mode === "near" ? " segmented__item--active" : ""}`}
            onClick={() => setMode("near")}
          >
            {t("events.mode.near")}
          </button>
        </div>
      )}

      <div className="chip-row">
        {mode === "near" && <PlacePill place={place} onOpen={() => setSheetOpen(true)} />}
        {gameChips.length > 0 && (
          <>
            <button
              className={`chip-filter${gameId === null ? " chip-filter--active" : ""}`}
              onClick={() => setGameId(null)}
            >
              {t(isAuthenticated ? "events.allMyGames" : "home.filterAll")}
            </button>
            {gameChips.map((game) => (
              <button
                key={game.id}
                className={`chip-filter${gameId === game.id ? " chip-filter--active" : ""}`}
                onClick={() => setGameId(game.id)}
              >
                {game.name}
              </button>
            ))}
          </>
        )}
      </div>

      {!ready && (
        <div className="card gate">
          <div className="gate__icon">
            <PinIcon size={32} />
          </div>
          <h2 className="gate__title">{t("events.place.inviteTitle")}</h2>
          <p className="gate__text">{t("events.place.inviteText")}</p>
          <button className="btn btn--grad btn--block" onClick={() => setSheetOpen(true)}>
            {t("place.choose")}
          </button>
          {!isAuthenticated && (
            <Link to="/login" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>
              {t("events.place.orSignIn")}
            </Link>
          )}
        </div>
      )}

      {ready && (
        <StatusView
          loading={upcoming.loading}
          error={upcoming.error}
          onRetry={upcoming.reload}
          empty={
            upcoming.data && upcomingEvents.length === 0
              ? near
                ? t("events.emptyNear", {
                    radius: near.radiusKm,
                    place: placeName(near),
                  })
                : t("events.emptyMine")
              : undefined
          }
        />
      )}

      {ready && upcoming.data && upcomingEvents.length === 0 && near && nextRadius && (
        <button
          className="btn btn--outline btn--block"
          onClick={() => save({ ...near, radiusKm: nextRadius })}
        >
          {t("events.widen", { radius: nextRadius })}
        </button>
      )}
      {ready && upcoming.data && upcomingEvents.length === 0 && mode === "mine" && (
        <div className="events-empty-actions">
          <Link to="/lairs" className="btn btn--outline btn--block">
            {t("events.findLairs")}
          </Link>
          <button className="btn btn--ghost btn--block" onClick={() => setMode("near")}>
            {t("events.mode.near")}
          </button>
        </div>
      )}

      {upcomingEvents.map((event) => (
        <EventCard key={event.id} event={event} myUserId={user?.id} onChanged={reloadAll} />
      ))}

      {ready &&
        (!showPast ? (
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
              empty={past.data && pastEvents.length === 0 ? t("events.emptyPast") : undefined}
            />
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} myUserId={user?.id} onChanged={reloadAll} />
            ))}
          </>
        ))}

      {sheetOpen && (
        <LocationSheet
          initial={place}
          onSave={(next) => {
            save(next);
            setSheetOpen(false);
          }}
          onClear={clear}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
