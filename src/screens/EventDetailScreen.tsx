import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getEvent, toggleEventFavorite } from "../api/events";
import { BackHeader } from "../components/BackHeader";
import { ExternalLinkIcon, PinIcon, StarIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { isSafeUrl } from "../lib/safe-url";
import { useAuth } from "../store/auth";

const statusLabelKeys: Record<string, string> = {
  "sold-out": "events.statusSoldOut",
  cancelled: "events.statusCancelled",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { eventId = "" } = useParams();
  const { data, loading, error, reload } = useApi(() => getEvent(eventId), [eventId]);
  const [busy, setBusy] = useState(false);

  const myUserId = user?.id;
  const isRegistered = !!myUserId && (data?.participants ?? []).includes(myUserId);
  const isPreRegistered =
    isRegistered && data?.participantRegistrations?.[myUserId ?? ""] === "PRE_REGISTERED";
  const isFavorited = !!myUserId && (data?.favoritedBy ?? []).includes(myUserId);

  function toggleFavorite() {
    if (busy) return;
    setBusy(true);
    toggleEventFavorite(eventId)
      .then(reload)
      .catch(() => {
        /* silencieux : échoue si non connecté */
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className="screen">
      <BackHeader
        title={data?.name ?? t("events.detailFallbackTitle")}
        action={
          <button
            type="button"
            className={`icon-button${isFavorited ? " icon-button--primary" : ""}`}
            onClick={toggleFavorite}
            disabled={busy}
            aria-label={t(isFavorited ? "events.unfavorite" : "events.favorite")}
            aria-pressed={isFavorited}
          >
            <StarIcon size={18} filled={isFavorited} />
          </button>
        }
      />
      <StatusView loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <p className="list-meta">
            {formatDateTime(data.startDateTime)}
            <br />
            {[data.game?.name ?? data.gameName, data.lair?.name].filter(Boolean).join(" · ")}
          </p>

          <p className="event-card__meta" style={{ marginBottom: 16 }}>
            {isRegistered && (
              <span className="chip chip--accent">
                {t(isPreRegistered ? "events.preRegistered" : "events.registered")}
              </span>
            )}
            {data.status && statusLabelKeys[data.status] ? (
              <span className="chip chip--danger">{t(statusLabelKeys[data.status])}</span>
            ) : (
              <span className="chip chip--accent">{t("events.statusOpen")}</span>
            )}
            {typeof data.price === "number" && data.price > 0 && (
              <span className="chip">{data.price} €</span>
            )}
            {typeof data.maxParticipants === "number" && (
              <span className="chip">
                {data.registeredParticipantsCount ?? 0}/{data.maxParticipants}
              </span>
            )}
          </p>

          {data.lair?.address && (
            <p className="list-meta">
              <PinIcon size={14} /> {data.lair.address}
            </p>
          )}

          {data.description && <p className="list-meta">{data.description}</p>}

          {data.url && isSafeUrl(data.url) && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline btn--block"
              style={{ marginTop: 8 }}
            >
              <ExternalLinkIcon size={16} />
              {t("events.externalLink")}
            </a>
          )}
        </>
      )}
    </div>
  );
}
