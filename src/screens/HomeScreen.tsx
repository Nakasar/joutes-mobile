import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { listNews } from "../api/news";
import type { News } from "../api/types";
import { CachedImage } from "../components/CachedImage";
import { HeartIcon, SearchIcon, SettingsIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
  });
}

function FeaturedCard({ item }: { item: News }) {
  const { t } = useTranslation();
  const game = item.games?.[0]?.name;
  return (
    <Link to={`/news/${item.id}`} className="featured">
      {item.banner ? (
        <CachedImage
          src={item.banner}
          alt=""
          className="featured__img"
          loading="lazy"
        />
      ) : (
        <div className="featured__img featured__img--placeholder shimmer" />
      )}
      <div className="featured__overlay">
        <span className="chip chip--grad featured__badge">
          {t("home.featuredBadge")}
          {game ? ` · ${game}` : ""}
        </span>
        <h2 className="featured__title">{item.title}</h2>
        <p className="featured__meta">
          {[game, formatDate(item.createdAt)].filter(Boolean).join(" · ")}
          {typeof item.likesCount === "number" && item.likesCount > 0 && (
            <span className="like-inline">
              · <HeartIcon size={13} filled /> {item.likesCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

function NewsItem({ item }: { item: News }) {
  const game = item.games?.[0]?.name;
  return (
    <Link to={`/news/${item.id}`} className="news-item">
      {item.banner ? (
        <CachedImage
          src={item.banner}
          alt=""
          className="news-item__thumb"
          loading="lazy"
        />
      ) : (
        <div className="news-item__thumb shimmer" />
      )}
      <div className="news-item__body">
        {game && <p className="news-item__game">{game}</p>}
        <h3 className="news-item__title">{item.title}</h3>
        {item.summary && <p className="news-item__summary">{item.summary}</p>}
        <p className="news-item__meta">
          {formatDate(item.createdAt)}
          {typeof item.likesCount === "number" && item.likesCount > 0 && (
            <span className="like-inline">
              <HeartIcon size={12} filled /> {item.likesCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [gameId, setGameId] = useState<string | null>(null);

  const games = useApi(() => listGames());
  const { data, loading, error, reload } = useApi(
    () => listNews({ limit: 20, gameId: gameId ?? undefined }),
    [gameId],
  );

  const news = data?.news ?? [];
  const [featured, ...rest] = news;

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <p className="eyebrow">
            <img src="/joutes-logo.png" alt="" className="eyebrow__logo" />
            {t("home.eyebrow")}
          </p>
          <h1 className="screen-title">{t("home.title")}</h1>
        </div>
        <div className="head-actions">
          <button className="icon-button" aria-label={t("common.search")}>
            <SearchIcon size={20} />
          </button>
          <button
            className="icon-button"
            aria-label={t("common.settings")}
            onClick={() => navigate("/settings")}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </div>

      {games.data && games.data.length > 0 && (
        <div className="chip-row">
          <button
            className={`chip-filter${gameId === null ? " chip-filter--active" : ""}`}
            onClick={() => setGameId(null)}
          >
            {t("home.filterAll")}
          </button>
          {games.data.map((game) => (
            <button
              key={game._id}
              className={`chip-filter${gameId === game._id ? " chip-filter--active" : ""}`}
              onClick={() => setGameId(game._id)}
            >
              {game.name}
            </button>
          ))}
        </div>
      )}

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data && news.length === 0 ? t("home.empty") : undefined}
      />

      {featured && <FeaturedCard item={featured} />}
      {rest.map((item) => (
        <NewsItem key={item.id} item={item} />
      ))}
    </div>
  );
}
