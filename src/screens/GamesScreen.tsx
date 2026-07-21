import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import type { GameSummary } from "../api/types";
import { CachedImage } from "../components/CachedImage";
import { ChevronIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useOnline } from "../hooks/useOnline";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { listMeta } from "../lib/offline-store";

function GameRow({
  game,
  browsable,
}: {
  game: GameSummary;
  browsable: boolean;
}) {
  const { t } = useTranslation();
  const color = colorFor(game.slug, (game as { color?: string }).color);

  const inner = (
    <>
      <span className="game-row__bar" style={{ background: color }} />
      {game.icon ? (
        <CachedImage
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
        {game.description && <p className="game-row__desc">{game.description}</p>}
        {browsable ? (
          game.type && <span className="chip">{game.type}</span>
        ) : (
          <span className="chip">{t("games.unavailableOffline")}</span>
        )}
      </div>
      {browsable && (
        <span className="chevron">
          <ChevronIcon size={20} />
        </span>
      )}
    </>
  );

  if (!browsable) {
    // Jeu non téléchargé et appareil hors ligne : grisé et non cliquable.
    return (
      <div
        className="game-row game-row--offline"
        aria-disabled="true"
        title={t("games.offlineHint")}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link to={`/games/${game.slug}/cards`} className="game-row">
      {inner}
    </Link>
  );
}

export function GamesScreen() {
  const { t } = useTranslation();
  const online = useOnline();
  const { data, loading, error, reload } = useApi(() => listGames());
  const offline = useApi(() => listMeta());

  const downloaded = useMemo(
    () => new Set((offline.data ?? []).map((m) => m.slug)),
    [offline.data],
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("games.title")}</h1>
          <p className="screen-subtitle">{t("games.subtitle")}</p>
        </div>
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data?.length === 0 ? t("games.empty") : undefined}
      />

      {data?.map((game) => (
        <GameRow
          key={game._id}
          game={game}
          browsable={online || downloaded.has(game.slug)}
        />
      ))}
    </div>
  );
}
