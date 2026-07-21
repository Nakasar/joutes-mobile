import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getNews, toggleNewsLike } from "../api/news";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { GameMarkdown } from "../components/GameMarkdown";
import { BackIcon, HeartIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { annotateErrataMarkdown } from "../lib/errata-markdown";
import { currentLocale } from "../i18n";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
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
  const { t } = useTranslation();
  const { newsId = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(
    () => getNews(newsId),
    [newsId],
  );

  // Le jeu principal de l'actualité sert de contexte pour les liens de règles.
  const gameSlug = data?.games?.[0]?.slug ?? "riftbound";

  const contentMarkdown = useMemo(
    () =>
      data?.content ? annotateErrataMarkdown(data.content, EMPTY_CARD_MAP) : null,
    [data?.content],
  );

  function like() {
    if (!data) return;
    toggleNewsLike(data.id)
      .then(() => reload())
      .catch(() => {
        /* silencieux : le like échoue si non connecté */
      });
  }

  if (!data) {
    return (
      <div className="screen">
        <BackHeader title={t("news.detailTitle")} />
        <StatusView loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingTop: 0, paddingLeft: 16, paddingRight: 16 }}>
      <div className="news-detail__banner">
        <button
          className="floating-back"
          onClick={() => navigate(-1)}
          aria-label={t("common.back")}
        >
          <BackIcon size={20} />
        </button>
        {data.banner ? (
          <CachedImage src={data.banner} alt="" loading="lazy" />
        ) : (
          <div className="shimmer" style={{ width: "100%", height: "100%" }} />
        )}
      </div>

      <article className="news-detail__body">
        {((data.games && data.games.length > 0) ||
          (data.tags && data.tags.length > 0)) && (
          <div className="news-detail__tags">
            {data.games?.map((game) => (
              <span key={game.id} className="chip chip--grad">
                {game.name}
              </span>
            ))}
            {data.tags?.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="news-detail__title">{data.title}</h1>
        <p className="news-detail__meta">
          {formatDate(data.createdAt)}
          {data.author?.displayName ? ` · ${data.author.displayName}` : ""}
        </p>

        {data.summary && (
          <p className="news-detail__summary">{data.summary}</p>
        )}
        {contentMarkdown && (
          <div className="news-detail__content">
            <GameMarkdown markdown={contentMarkdown} gameSlug={gameSlug} />
          </div>
        )}

        <button className="like-button" onClick={like}>
          <span
            className={`like-button__heart${data.userHasLiked ? " like-button__heart--on" : ""}`}
          >
            <HeartIcon size={18} filled={data.userHasLiked} />
          </span>
          {data.likesCount ?? 0}
        </button>
      </article>
    </div>
  );
}
