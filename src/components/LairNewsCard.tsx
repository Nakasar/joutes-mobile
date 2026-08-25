import { useTranslation } from "react-i18next";
import type { LairNewsItem } from "../api/types";
import { currentLocale } from "../i18n";
import { externalUrl } from "../lib/lair-urls";
import { CachedImage } from "./CachedImage";
import { ExternalLinkIcon, PinIcon } from "./icons";
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
 * Une annonce du lieu.
 *
 * L'annonce épinglée se lit **en entier**, corps compris : c'est ce que le lieu
 * a décidé de mettre en tête, et le replier derrière une touche annulerait
 * l'épinglage. Les autres s'en tiennent à leur résumé.
 *
 * Le corps est du markdown écrit par le gérant, donc rendu par `UserMarkdown` —
 * rien n'y a été annoté, et un `card://` tapé à la main ne doit pas devenir un
 * lien.
 */
export function LairNewsCard({ item }: { item: LairNewsItem }) {
  const { t } = useTranslation();
  const link = externalUrl(item.link);
  const date = formatDate(item.publishedAt);

  return (
    <article className={`card lair-news${item.pinned ? " lair-news--pinned" : ""}`}>
      {item.banner && (
        <CachedImage src={item.banner} alt="" className="lair-news__banner" />
      )}

      <div className="lair-news__head">
        {item.pinned && (
          <span className="chip lair-news__pin">
            <PinIcon size={12} />
            {t("lairs.news.pinned")}
          </span>
        )}
        {item.category && <span className="chip">{item.category}</span>}
      </div>

      <h3 className="lair-news__title">{item.title}</h3>
      {date && <p className="lair-news__date">{date}</p>}

      {item.summary && <p className="lair-news__summary">{item.summary}</p>}

      {item.pinned && item.content && <UserMarkdown>{item.content}</UserMarkdown>}

      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="header-link">
          <ExternalLinkIcon size={13} />
          {item.linkLabel || t("lairs.news.openLink")}
        </a>
      )}
    </article>
  );
}
