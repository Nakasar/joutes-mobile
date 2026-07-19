import { Link } from "react-router-dom";
import { listGames } from "../api/games";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

export function GamesScreen() {
  const { data, loading, error, reload } = useApi(() => listGames());

  return (
    <div className="screen">
      <header className="screen__header">
        <h1>Jeux</h1>
      </header>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? "Aucun jeu." : undefined}
      />
      {data?.map((game) => (
        <Link
          key={game._id}
          to={`/games/${game.slug}/cards`}
          className="card game-card game-card--link"
        >
          {game.icon && (
            <img src={game.icon} alt="" className="game-card__icon" loading="lazy" />
          )}
          <div className="game-card__body">
            <h2>{game.name}</h2>
            {game.description && <p className="muted">{game.description}</p>}
            {game.type && <span className="chip">{game.type}</span>}
          </div>
          <span className="game-card__chevron" aria-hidden>
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
