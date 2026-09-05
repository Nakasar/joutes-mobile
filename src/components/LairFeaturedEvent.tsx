import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { JoutesEvent } from "../api/types";
import { currentLocale } from "../i18n";
import { CachedImage } from "./CachedImage";
import { CalendarIcon, ChevronIcon } from "./icons";

/**
 * L'événement que le lieu met en avant : une carte à l'accent du lieu, plus
 * grande qu'une ligne d'agenda, avec la bannière du jeu quand il en a une.
 * Ne se montre que tant que l'événement est à venir — après, il n'y a plus
 * rien à annoncer.
 */
export function LairFeaturedEvent({ event }: { event: JoutesEvent }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const start = new Date(event.startDateTime);
  const banner = event.game?.banner;

  return (
    <Link to={`/events/${event.id}`} className="lair-featured">
      {banner && <CachedImage src={banner} alt="" className="lair-featured__banner" />}
      <div className="lair-featured__body">
        <span className="chip chip--grad">{t("lairs.featured")}</span>
        <h3 className="lair-featured__name">{event.name}</h3>
        <p className="lair-featured__when">
          <CalendarIcon size={13} />
          {start.toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {" · "}
          {start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="lair-featured__meta">
          {[
            event.game?.name ?? event.gameName,
            typeof event.maxParticipants === "number"
              ? `${event.registeredParticipantsCount ?? 0}/${event.maxParticipants}`
              : null,
            typeof event.price === "number" && event.price > 0 ? `${event.price} €` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}
