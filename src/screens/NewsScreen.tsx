import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { listNews } from "../api/news";
import { getMyGames } from "../api/users";
import { localizeNews } from "../lib/news";
import type { News } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { HeartIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useSearchParam } from "../hooks/useSearchParamState";
import { currentLocale } from "../i18n";
import { useAuth } from "../store/auth";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
  });
}

function FeaturedCard({ item }: { item: News }) {
  const { t, i18n } = useTranslation();
  const game = item.games?.[0]?.name;
  // La liste parle la langue du lecteur, comme le détail.
  const localized = localizeNews(item, i18n.resolvedLanguage ?? i18n.language);
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
        <h2 className="featured__title" lang={localized.title.lang}>
          {localized.title.text}
        </h2>
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
  const { i18n } = useTranslation();
  const game = item.games?.[0]?.name;
  const localized = localizeNews(item, i18n.resolvedLanguage ?? i18n.language);
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
        <h3 className="news-item__title" lang={localized.title.lang}>
          {localized.title.text}
        </h3>
        {localized.summary.text && (
          <p className="news-item__summary" lang={localized.summary.lang}>
            {localized.summary.text}
          </p>
        )}
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

/**
 * Toutes les actualités — ce que l'accueil était avant de devenir un fil.
 *
 * Connecté, les puces sont les jeux qu'on suit et « Tous les miens » les
 * demande ensemble ; un visiteur a le catalogue entier. Le choix vit dans
 * l'URL, comme partout.
 */
export function NewsScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [gameId, setGameId] = useSearchParam("game");

  const myGames = useApi(
    () => (isAuthenticated ? getMyGames() : Promise.resolve(null)),
    [isAuthenticated],
  );
  const catalog = useApi(() => (isAuthenticated ? Promise.resolve(null) : listGames()), [
    isAuthenticated,
  ]);
  const chips = isAuthenticated
    ? (myGames.data?.games ?? []).map((game) => ({ id: game.id, name: game.name }))
    : (catalog.data ?? []).map((game) => ({ id: game._id, name: game.name }));
  const followedIds = myGames.data?.gameIds ?? [];

  // Sans jeu choisi : les jeux suivis, ensemble ; un compte qui n'en suit
  // aucun, comme un visiteur, lit tout.
  const scope = gameId ? gameId : followedIds.length > 0 ? followedIds : undefined;
  const ready = !isAuthenticated || myGames.data !== null;

  const { data, loading, error, reload } = useApi(
    () => (ready ? listNews({ limit: 20, gameId: scope }) : Promise.resolve(null)),
    [ready, gameId, followedIds.join(",")],
  );

  const news = data?.news ?? [];
  const [featured, ...rest] = news;

  return (
    <div className="screen">
      <BackHeader title={t("news.title")} />

      {chips.length > 0 && (
        <div className="chip-row">
          <button
            className={`chip-filter${gameId === null ? " chip-filter--active" : ""}`}
            onClick={() => setGameId(null)}
          >
            {t(isAuthenticated && followedIds.length > 0 ? "home.games.allMine" : "home.filterAll")}
          </button>
          {chips.map((game) => (
            <button
              key={game.id}
              className={`chip-filter${gameId === game.id ? " chip-filter--active" : ""}`}
              onClick={() => setGameId(game.id)}
            >
              {game.name}
            </button>
          ))}
        </div>
      )}

      <StatusView
        loading={loading || !ready}
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
