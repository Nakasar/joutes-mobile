import { Link } from "react-router-dom";
import { getCollectionOverview } from "../api/collection";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
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
        <div className="card">
          <h2>Vue d'ensemble</h2>
          <p>
            {data.totalCopies} carte{data.totalCopies > 1 ? "s" : ""} sur{" "}
            {data.gamesWithItems} jeu{data.gamesWithItems > 1 ? "x" : ""}
          </p>
        </div>
      )}
      {games.map((game) => {
        const percent =
          game.gameTotal > 0
            ? Math.round((game.gameOwned / game.gameTotal) * 100)
            : 0;
        return (
          <div key={game.gameId} className="card game-card">
            {game.icon && (
              <img
                src={game.icon}
                alt=""
                className="game-card__icon"
                loading="lazy"
              />
            )}
            <div className="game-card__body">
              <h2>{game.name}</h2>
              <p className="muted">
                {game.copies} exemplaire{game.copies > 1 ? "s" : ""} —{" "}
                {game.gameOwned}/{game.gameTotal} cartes ({percent}%)
              </p>
              <div className="progress">
                <div
                  className="progress__bar"
                  style={{ width: `${percent}%`, background: game.color }}
                />
              </div>
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
      <header className="screen__header">
        <h1>Collection</h1>
      </header>
      {isAuthenticated ? (
        <CollectionContent />
      ) : (
        <div className="card">
          <h2>Connexion requise</h2>
          <p>
            Connectez-vous pour retrouver votre collection de cartes, vos
            wishlists et vos listes de vente.
          </p>
          <Link to="/login" className="button-primary button-link">
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
