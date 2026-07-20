import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { getNews, toggleNewsLike } from "../api/news";
import { BackHeader } from "../components/BackHeader";
import { GameMarkdown } from "../components/GameMarkdown";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { annotateErrataMarkdown } from "../lib/errata-markdown";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// L'API de détail des news ne renvoie pas de résolution des noms de cartes
// (`cardIdByName`), contrairement au détail de carte. Les mots-clés et icônes
// restent stylisés côté client ; les mentions `[Carte]` non résolues sont
// laissées en texte, comme le fait le web lorsqu'un nom n'est pas reconnu.
const EMPTY_CARD_MAP = new Map<string, string>();

export function NewsDetailScreen() {
  const { newsId = "" } = useParams();
  const { data, loading, error, reload } = useApi(
    () => getNews(newsId),
    [newsId],
  );

  // Le jeu principal de l'actualité sert de contexte pour les liens de règles.
  const gameSlug = data?.games?.[0]?.slug ?? "riftbound";

  const contentMarkdown = useMemo(
    () => (data?.content ? annotateErrataMarkdown(data.content, EMPTY_CARD_MAP) : null),
    [data?.content],
  );

  return (
    <div className="screen">
      <BackHeader title={data?.title ?? "Actualité"} />
      <StatusView loading={loading} error={error} onRetry={reload} />
      {data && (
        <article className="news-detail">
          {data.banner && (
            <img
              src={data.banner}
              alt=""
              className="news-detail__banner"
              loading="lazy"
            />
          )}
          <h1 className="news-detail__title">{data.title}</h1>
          <p className="news-detail__meta muted">
            {data.games?.map((game) => game.name).join(" · ")}
            {data.games?.length ? " — " : ""}
            {formatDate(data.createdAt)}
            {data.author?.displayName ? ` · ${data.author.displayName}` : ""}
          </p>
          {data.tags && data.tags.length > 0 && (
            <p className="news-detail__tags">
              {data.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </p>
          )}
          {data.summary && (
            <p className="news-detail__summary">{data.summary}</p>
          )}
          {contentMarkdown && (
            <div className="news-detail__content">
              <GameMarkdown markdown={contentMarkdown} gameSlug={gameSlug} />
            </div>
          )}
          <div className="news-detail__actions">
            <button
              className="button-ghost"
              onClick={() => {
                toggleNewsLike(data.id)
                  .then(() => reload())
                  .catch(() => {
                    /* silencieux : le like échoue si non connecté */
                  });
              }}
            >
              {data.userHasLiked ? "❤️" : "🤍"} {data.likesCount ?? 0}
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
