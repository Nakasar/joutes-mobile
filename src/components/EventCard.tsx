import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toggleEventFavorite } from "../api/events";
import type { JoutesEvent } from "../api/types";
import { AwardIcon, FlameIcon, StarIcon } from "./icons";
import { currentLocale } from "../i18n";
import { friendsSentence, highlightReason } from "../lib/event-highlights";

/**
 * Une carte d'événement : la date en bloc, le nom, le jeu et le lieu, les
 * puces d'état, et l'étoile du favori pour qui a un compte. Servie par
 * l'agenda, la vitrine d'un lieu et l'accueil.
 *
 * Les marques (choix du lieu, populaire, amis) s'ajoutent aux puces. Avec
 * `showReason`, la plus forte passe en tête de carte, en une phrase : c'est
 * ce qui distingue « À ne pas manquer » d'un second agenda.
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
  showReason = false,
}: {
  event: JoutesEvent;
  myUserId: string | undefined;
  onChanged: () => void;
  showReason?: boolean;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const highlights = event.highlights;
  const reason = showReason && highlights ? highlightReason(highlights, t, locale, event.lair?.name) : null;
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
          {reason && (
            <p className={`event-card__reason event-card__reason--${reason.kind}`}>
              {reason.kind === "friends" && highlights && <FriendAvatars friends={highlights.friends} />}
              {reason.kind === "lairPick" && <AwardIcon size={15} />}
              {reason.kind === "popular" && <FlameIcon size={15} />}
              <span>{reason.text}</span>
            </p>
          )}
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
            {highlights?.lairPick && reason?.kind !== "lairPick" && (
              <span className="chip chip--pick">
                <AwardIcon size={12} />
                {t("highlights.lairPick")}
              </span>
            )}
            {highlights?.popular && reason?.kind !== "popular" && (
              <span className="chip chip--hot">
                <FlameIcon size={12} />
                {t("highlights.popular")}
              </span>
            )}
            {highlights && highlights.friends.length > 0 && reason?.kind !== "friends" && (
              <span className="chip chip--friends">
                <FriendAvatars friends={highlights.friends} small />
                {friendsSentence(highlights.friends, t, locale, 2)}
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

/** Les avatars des amis, empilés : trois au plus. */
function FriendAvatars({ friends, small = false }: { friends: NonNullable<JoutesEvent["highlights"]>["friends"]; small?: boolean }) {
  return (
    <span className={`friend-avatars${small ? " friend-avatars--small" : ""}`} aria-hidden="true">
      {friends.slice(0, 3).map((friend) => (
        <span key={friend.id} className="friend-avatars__one">
          {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.displayName.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </span>
  );
}
