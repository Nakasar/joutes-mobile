import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { UserContent } from "../api/types";
import { isSafeUrl } from "../lib/safe-url";
import { CachedImage } from "./CachedImage";
import { ChevronIcon, ExternalLinkIcon, ScrollIcon } from "./icons";

/**
 * Une publication d'un joueur : article, vidéo ou replay.
 *
 * Un article s'ouvre dans l'application — il n'existe que là. Une vidéo et un
 * replay vivent ailleurs : leur carte est un lien sortant, et le dit par son
 * icône. Les faire passer par un écran intermédiaire ajouterait une touche pour
 * arriver au même endroit.
 */
export function UserContentCard({
  content,
  userTag,
}: {
  content: UserContent;
  userTag: string;
}) {
  const { t } = useTranslation();

  const body = (
    <>
      {content.thumbnail ? (
        <CachedImage src={content.thumbnail} alt="" className="content-card__thumb" />
      ) : (
        <span className="content-card__thumb content-card__thumb--empty">
          <ScrollIcon size={20} />
        </span>
      )}
      <div className="list-row__body">
        <p className="list-row__title">{content.title}</p>
        <p className="list-row__sub">
          {[t(`profile.publications.kind.${content.kind}`), content.duration]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {content.summary && <p className="list-row__sub">{content.summary}</p>}
      </div>
    </>
  );

  if (content.kind === "article") {
    return (
      <Link
        to={`/users/${userTag}/contents/${content.id}`}
        className="list-row list-row--link content-card"
      >
        {body}
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>
    );
  }

  // Une publication sans adresse utilisable ne mène nulle part : elle reste
  // lisible, sans lien mort.
  if (!content.url || !isSafeUrl(content.url)) {
    return <div className="list-row content-card">{body}</div>;
  }

  return (
    <a
      href={content.url}
      target="_blank"
      rel="noopener noreferrer"
      className="list-row list-row--link content-card"
    >
      {body}
      <span className="chevron">
        <ExternalLinkIcon size={16} />
      </span>
    </a>
  );
}
