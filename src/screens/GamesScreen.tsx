import { Link } from "react-router-dom";
import { listGames } from "../api/games";
import { ChevronIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";

export function GamesScreen() {
  const { data, loading, error, reload } = useApi(() => listGames());

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">Jeux</h1>
          <p className="screen-subtitle">Catalogues, cartes et règles</p>
        </div>
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? "Aucun jeu." : undefined}
      />

      {data?.map((game) => {
        const color = colorFor(game.slug, (game as { color?: string }).color);
        return (
          <Link
            key={game._id}
            to={`/games/${game.slug}/cards`}
            className="game-row"
          >
            <span className="game-row__bar" style={{ background: color }} />
            {game.icon ? (
              <img
                src={game.icon}
                alt=""
                className="avatar avatar--game"
                loading="lazy"
              />
            ) : (
              <span className="avatar avatar--game" style={tintStyle(color)}>
                {initialOf(game.name)}
              </span>
            )}
            <div className="game-row__body">
              <h2 className="game-row__name">{game.name}</h2>
              {game.description && (
                <p className="game-row__desc">{game.description}</p>
              )}
              {game.type && <span className="chip">{game.type}</span>}
            </div>
            <span className="chevron">
              <ChevronIcon size={20} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
