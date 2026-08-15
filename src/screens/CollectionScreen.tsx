import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCollectionOverview, recomputeCollectionValue } from "../api/collection";
import { CachedImage } from "../components/CachedImage";
import { CollectionValueCard } from "../components/CollectionValueCard";
import { ArrowLeftRightIcon, ChevronIcon, HeartIcon, LockIcon, TagIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { formatMoney } from "../lib/prices";
import { useAuth } from "../store/auth";

function CollectionContent() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(() =>
    getCollectionOverview(),
  );

  const games = data?.games.filter((game) => game !== null) ?? [];
  // Les jeux de figurines n'ont pas de cartes : sans cette liste, une gamme
  // suivie de bout en bout n'apparaîtrait nulle part dans la collection.
  const productGames = data?.productGames ?? [];

  return (
    <>
      <Link to="/wishlists" className="list-row list-row--link">
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <HeartIcon size={20} style={{ color: "var(--primary)" }} />
        </span>
        <div className="list-row__body">
          <p className="list-row__title">{t("collection.wishlistsAction")}</p>
        </div>
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>
      <Link to="/sell-lists/mine" className="list-row list-row--link">
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <TagIcon size={20} style={{ color: "var(--primary)" }} />
        </span>
        <div className="list-row__body">
          <p className="list-row__title">{t("collection.sellListAction")}</p>
        </div>
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>
      <Link to="/trades" className="list-row list-row--link">
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <ArrowLeftRightIcon size={20} style={{ color: "var(--primary)" }} />
        </span>
        <div className="list-row__body">
          <p className="list-row__title">{t("collection.tradeAction")}</p>
        </div>
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          data && games.length === 0 && productGames.length === 0
            ? t("collection.empty")
            : undefined
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
      {/* Le recalcul écrit les valeurs côté serveur ; l'écran se recharge
          ensuite pour les relire, jeux compris. */}
      {data && games.length > 0 && (
        <CollectionValueCard
          value={data.value}
          copies={data.totalCopies}
          onRecompute={async () => {
            await recomputeCollectionValue();
            reload();
          }}
        />
      )}
      {games.map((game) => {
        const percent =
          game.gameTotal > 0
            ? Math.round((game.gameOwned / game.gameTotal) * 100)
            : 0;
        const color = colorFor(game.slug, game.color);
        const body = (
          <>
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
              <div className="collection-game__side">
                <span className="collection-game__pct" style={{ color }}>
                  {percent}%
                </span>
                {/* Valeur telle qu'elle a été calculée ; elle se recalcule sur
                    la page du jeu, où l'on voit ce qu'elle compte. */}
                {game.value && (
                  <span className="collection-game__value">{formatMoney(game.value)}</span>
                )}
              </div>
            </div>
            <div className="progress">
              <div
                className="progress__bar"
                style={{ width: `${percent}%`, background: color }}
              />
            </div>
          </>
        );
        return game.slug ? (
          <Link
            key={game.gameId}
            to={`/collection/${game.slug}`}
            className="collection-game collection-game--link"
          >
            {body}
          </Link>
        ) : (
          <div key={game.gameId} className="collection-game">
            {body}
          </div>
        );
      })}

      {productGames.length > 0 && (
        <>
          <h2 className="section-title">{t("collection.productsTitle")}</h2>
          {productGames.map((game) => {
            // La gamme de figurines est ce qu'un joueur suit vraiment : les
            // boîtes sont un moyen, pas la fin. C'est donc elle que la jauge
            // montre, et non le catalogue entier.
            const percent =
              game.unitsTotal > 0
                ? Math.round((game.unitsOwned / game.unitsTotal) * 100)
                : 0;
            // Couleur dérivée du slug, et non celle déclarée par le jeu :
            // Shatterpoint annonce du blanc, illisible sur le thème clair. La
            // pastille de repli n'apparaît de toute façon qu'à défaut d'icône.
            const color = colorFor(game.slug ?? game.gameId);
            const body = (
              <>
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
                    <h3 className="collection-game__name">{game.name}</h3>
                    <p className="collection-game__sub">
                      {t("collection.productGameStats", {
                        count: game.copies,
                        owned: game.unitsOwned,
                        total: game.unitsTotal,
                        copies: game.copies,
                      })}
                    </p>
                  </div>
                  <span className="collection-game__pct">{percent}%</span>
                </div>
                <div className="progress">
                  <div className="progress__bar" style={{ width: `${percent}%` }} />
                </div>
              </>
            );
            return game.slug ? (
              <Link
                key={game.gameId}
                to={`/collection/${game.slug}/products`}
                className="collection-game collection-game--link"
              >
                {body}
              </Link>
            ) : (
              <div key={game.gameId} className="collection-game">
                {body}
              </div>
            );
          })}
        </>
      )}
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
