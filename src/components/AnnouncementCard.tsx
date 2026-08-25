import { useTranslation } from "react-i18next";
import type { PlayGroupAnnouncement } from "../api/types";
import { currentLocale } from "../i18n";
import { UserMarkdown } from "./UserMarkdown";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(currentLocale(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

/**
 * Une annonce du groupe.
 *
 * La portée est affichée telle quelle, et c'est délibéré : celui qui lit le mur
 * interne doit voir d'un coup d'œil ce qui sort du groupe et ce qui n'en sort
 * pas. La cacher ferait publier « on se retrouve chez Yann » sur une page
 * ouverte à tous sans que personne le remarque.
 */
export function AnnouncementCard({
  announcement,
  showScope = true,
}: {
  announcement: PlayGroupAnnouncement;
  showScope?: boolean;
}) {
  const { t } = useTranslation();
  const date = formatDate(announcement.publishedAt);

  return (
    <article className="card announcement-card">
      <div className="announcement-card__head">
        <h3 className="announcement-card__title">{announcement.title}</h3>
        {showScope && (
          <span
            className={`chip${announcement.scope === "public" ? " chip--accent" : ""}`}
          >
            {t(`social.announcements.scope.${announcement.scope}`)}
          </span>
        )}
      </div>
      {date && <p className="announcement-card__date">{date}</p>}
      {announcement.body && <UserMarkdown>{announcement.body}</UserMarkdown>}
    </article>
  );
}
