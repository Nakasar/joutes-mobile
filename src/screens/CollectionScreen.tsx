import { Link } from "react-router-dom";
import { getCollectionOverview } from "../api/collection";
import { CachedImage } from "../components/CachedImage";
import { LockIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { useAuth } from "../store/auth";

function CollectionContent() {
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
          data && games.length === 0
            ? "Votre collection est vide pour l'instant."
            : undefined
        }
      />
      {data && games.length > 0 && (
        <div className="overview-card">
          <span className="overview-card__circle" />
          <p className="overview-card__total">{data.totalCopies}</p>
          <p className="overview-card__sub">
            carte{data.totalCopies > 1 ? "s" : ""} sur {data.gamesWithItems} jeu
            {data.gamesWithItems > 1 ? "x" : ""}
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
                  {game.gameOwned}/{game.gameTotal} cartes · {game.copies}{" "}
                  exemplaire{game.copies > 1 ? "s" : ""}
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
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">Collection</h1>
        </div>
      </div>
      {isAuthenticated ? (
        <CollectionContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">Connexion requise</h2>
          <p className="gate__text">
            Connectez-vous pour retrouver votre collection, vos wishlists et vos
            listes de vente.
          </p>
          <Link to="/login" className="btn btn--grad btn--block">
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
