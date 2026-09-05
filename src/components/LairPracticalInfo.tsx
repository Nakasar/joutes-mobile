import { useTranslation } from "react-i18next";
import type { LairDetail } from "../api/types";
import { currentLocale } from "../i18n";
import { formatOpeningRanges, readOpeningState } from "../lib/lair-hours";
import { externalUrl } from "../lib/lair-urls";
import { distanceKm, formatDistance, type SavedPlace } from "../lib/saved-place";
import { Movement } from "./Movement";
import { ExternalLinkIcon, PinIcon } from "./icons";

/**
 * L'itinéraire jusqu'au lieu, sur la carte du système.
 *
 * Le point du lieu quand il en a un — c'est lui qui est juste — et l'adresse
 * en repli. Un lien plutôt qu'un plan intégré : le mobile n'embarque pas de
 * carte, et celle du système sait guider jusqu'à la porte.
 */
export function directionsUrl(lair: Pick<LairDetail, "address" | "location">): string | null {
  const coords = lair.location?.coordinates;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (coords && coords.length === 2) {
    const [lng, lat] = coords;
    return ios
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (lair.address) {
    const query = encodeURIComponent(lair.address);
    return ios
      ? `https://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return null;
}

/** `tel:` n'ouvre rien dans la vue web d'un bureau : le bouton n'y est pas. */
function canCall(): boolean {
  return /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Les informations pratiques : ouvert ou fermé, et jusqu'à quand ; l'adresse
 * et la distance depuis la ville qu'on a dite ; l'itinéraire, l'appel, le
 * courriel, le site. Ce qu'on cherche en bas de la rue, pas ce que le lieu
 * raconte sur lui-même.
 */
export function LairPracticalInfo({
  lair,
  place,
}: {
  lair: LairDetail;
  place: SavedPlace | null;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const opening = readOpeningState(lair.options?.openingHours, locale);
  const phone = lair.options?.contact?.phone;
  const email = lair.options?.contact?.email;
  const website = externalUrl(lair.website);
  const directions = directionsUrl(lair);
  const coords = lair.location?.coordinates;
  const distance =
    place && coords && coords.length === 2
      ? distanceKm(place, { latitude: coords[1], longitude: coords[0] })
      : null;

  if (!lair.address && !website && !coords && !phone && !email && opening.isOpen === null) {
    return null;
  }

  const todayRanges = formatOpeningRanges(opening.today, locale);

  return (
    <section className="card lair-practical">
      <Movement
        section
        title={t("lairs.portal.practical.title")}
        aside={
          opening.isOpen === null
            ? undefined
            : opening.isOpen
              ? t("lairs.hours.open")
              : t("lairs.hours.closed")
        }
        asideTone={opening.isOpen ? "open" : undefined}
      />

      {opening.isOpen !== null && (
        <p className="lair-practical__today">
          {opening.isOpen && opening.closesAt
            ? t("lairs.hours.openUntil", { time: opening.closesAt })
            : todayRanges.length > 0
              ? t("lairs.portal.practical.today", { ranges: todayRanges.join(", ") })
              : t("lairs.portal.practical.closedToday")}
        </p>
      )}

      {lair.address && (
        <p className="lair-practical__address">
          <PinIcon size={14} />
          <span>
            {lair.address}
            {distance !== null && (
              <span className="muted"> · {formatDistance(distance, locale)}</span>
            )}
          </span>
        </p>
      )}

      {(phone || email || website) && (
        <div className="lair-practical__contact">
          {phone && <span>{phone}</span>}
          {email && (
            <a href={`mailto:${email}`} className="header-link">
              <ExternalLinkIcon size={13} />
              {email}
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="header-link">
              <ExternalLinkIcon size={13} />
              {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          )}
        </div>
      )}

      {(directions || (phone && canCall())) && (
        <div className="lair-practical__actions">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--grad follow-btn"
            >
              {t("lairs.portal.practical.directions")}
            </a>
          )}
          {phone && canCall() && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn--outline">
              {t("lairs.portal.practical.call")}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
