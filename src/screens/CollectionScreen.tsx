import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCollectionOverview } from "../api/collection";
import { CachedImage } from "../components/CachedImage";
import { LockIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { useAuth } from "../store/auth";

function CollectionContent() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(() =>
    getCollectionOverview(),
  );

  const games = data?.games.filter((game) => game !== null) ?? [];

  return (
    <>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          data && games.length === 0 ? t("collection.empty") : undefined
        }
      />
      {data && games.length > 0 && (
        <div className="overview-card">
          <span className="overview-card__circle" />
          <p className="overview-card__total">{data.totalCopies}</p>
          <p className="overview-card__sub">
            {t("collection.overviewSub", {
              count: data.totalCopies,
              games: data.gamesWithItems,
              gamesWord: t("collection.game", { count: data.gamesWithItems }),
            })}
          </p>
        </div>
      )}
      {games.map((game) => {
        const percent =
          game.gameTotal > 0
            ? Math.round((game.gameOwned / game.gameTotal) * 100)
            : 0;
        const color = colorFor(game.slug, game.color);
        return (
          <div key={game.gameId} className="collection-game">
            <div className="collection-game__head">
              {game.icon ? (
                <CachedImage
                  src={game.icon}
                  alt=""
                  className="avatar avatar--sm"
                  loading="lazy"
                />
              ) : (
                <span className="avatar avatar--sm" style={tintStyle(color)}>
                  {initialOf(game.name)}
                </span>
              )}
              <div className="collection-game__body">
                <h2 className="collection-game__name">{game.name}</h2>
                <p className="collection-game__sub">
                  {t("collection.gameStats", {
                    count: game.copies,
                    owned: game.gameOwned,
                    total: game.gameTotal,
                    copies: game.copies,
                  })}
                </p>
              </div>
              <span className="collection-game__pct" style={{ color }}>
                {percent}%
              </span>
            </div>
            <div className="progress">
              <div
                className="progress__bar"
                style={{ width: `${percent}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

export function CollectionScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("collection.title")}</h1>
        </div>
      </div>
      {isAuthenticated ? (
        <CollectionContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("collection.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      )}
    </div>
  );
}
