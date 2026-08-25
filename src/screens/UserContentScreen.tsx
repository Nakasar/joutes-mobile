import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserContents } from "../api/users";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { ExternalLinkIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { UserMarkdown } from "../components/UserMarkdown";
import { useApi } from "../hooks/useApi";
import { isSafeUrl } from "../lib/safe-url";
import { currentLocale } from "../i18n";

function formatDate(iso?: string): string {
  if (!iso) return "";
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
 * Un article publié par un joueur.
 *
 * L'API rend les publications d'un auteur en une seule liste, sans route par
 * publication : on relit donc la liste et on y cherche la bonne. Elle est déjà
 * en cache si l'on vient de la vitrine — le cas courant — et un article ouvert
 * par un lien collé ne coûte qu'une lecture de plus.
 *
 * Une vidéo ou un replay n'arrive normalement pas ici : sa carte pointe droit
 * sur sa plateforme. Si on y arrive quand même — un lien partagé, un contenu
 * qui a changé de nature — l'écran donne le lien plutôt qu'une page vide.
 */
export function UserContentScreen() {
  const { t } = useTranslation();
  const { userTag = "", contentId = "" } = useParams();
  const { data, loading, error, reload } = useApi(
    () => getUserContents(userTag),
    [userTag],
  );

  const content = data?.find((entry) => entry.id === contentId);

  if (!content) {
    return (
      <div className="screen">
        <BackHeader title={t("profile.publications.title")} />
        <StatusView
          loading={loading}
          error={error}
          onRetry={reload}
          empty={data && !content ? t("profile.publications.missing") : undefined}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <BackHeader title={content.title} />

      {content.thumbnail && (
        <CachedImage src={content.thumbnail} alt="" className="content-detail__banner" />
      )}

      <article className="content-detail">
        <h1 className="content-detail__title">{content.title}</h1>
        <p className="content-detail__meta">
          {[
            t(`profile.publications.kind.${content.kind}`),
            formatDate(content.publishedAt),
            content.duration,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {content.summary && <p className="content-detail__summary">{content.summary}</p>}

        {content.body ? (
          <UserMarkdown>{content.body}</UserMarkdown>
        ) : content.url && isSafeUrl(content.url) ? (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--grad btn--block"
          >
            <ExternalLinkIcon size={16} />
            {t("profile.publications.open")}
          </a>
        ) : (
          <p className="status muted">{t("profile.publications.noBody")}</p>
        )}
      </article>
    </div>
  );
}
