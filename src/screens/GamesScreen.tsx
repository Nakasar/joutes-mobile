import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { getMyFollowedGameIds } from "../api/users";
import type { GameSummary } from "../api/types";
import { CachedImage } from "../components/CachedImage";
import { ChevronIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useOnline } from "../hooks/useOnline";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { GAME_TYPE_ORDER, gameTypeOrderIndex, isKnownGameType } from "../lib/game-types";
import { listMeta } from "../lib/offline-store";
import { useAuth } from "../store/auth";

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
          game.type && <span className="chip">{t(`games.type.${game.type}`, game.type)}</span>
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
    <Link to={`/games/${game.slug}`} className="game-row">
      {inner}
    </Link>
  );
}

type Scope = "mine" | "all";

export function GamesScreen() {
  const { t } = useTranslation();
  const online = useOnline();
  const { isAuthenticated } = useAuth();
  const { data, loading, error, reload } = useApi(() => listGames());
  const offline = useApi(() => listMeta());
  const myGames = useApi(
    () => (isAuthenticated ? getMyFollowedGameIds() : Promise.resolve([])),
    [isAuthenticated],
  );

  const [scope, setScope] = useState<Scope>(() => (isAuthenticated ? "mine" : "all"));
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Le bascule "Mes jeux" disparaît à la déconnexion : si l'utilisateur se
  // déconnecte pendant qu'il consulte cet écran, on repasse sur "Tous les
  // jeux" pour ne pas rester bloqué sur une liste vide sans moyen d'en sortir.
  useEffect(() => {
    if (!isAuthenticated) setScope("all");
  }, [isAuthenticated]);

  const downloaded = useMemo(
    () => new Set((offline.data ?? []).map((m) => m.slug)),
    [offline.data],
  );
  const myGameIds = useMemo(() => new Set(myGames.data ?? []), [myGames.data]);

  const types = useMemo(() => {
    const present = new Set(
      (data ?? []).map((g) => g.type).filter((t): t is string => !!t),
    );
    const known = GAME_TYPE_ORDER.filter((type) => present.has(type));
    const unknown = Array.from(present)
      .filter((type) => !isKnownGameType(type))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...unknown];
  }, [data]);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (scope === "mine") list = list.filter((g) => myGameIds.has(g._id));
    if (typeFilter) list = list.filter((g) => g.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const byType = gameTypeOrderIndex(a.type) - gameTypeOrderIndex(b.type);
      return byType !== 0 ? byType : a.name.localeCompare(b.name);
    });
  }, [data, scope, myGameIds, typeFilter, search]);

  const showMineToggle = isAuthenticated;
  const mineLoading = scope === "mine" && myGames.loading;
  const mineError = scope === "mine" ? myGames.error : null;

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("games.title")}</h1>
          <p className="screen-subtitle">{t("games.subtitle")}</p>
        </div>
      </div>

      {showMineToggle && (
        <div className="segmented" style={{ marginBottom: 14 }}>
          <button
            className={`segmented__item${scope === "mine" ? " segmented__item--active" : ""}`}
            onClick={() => setScope("mine")}
          >
            {t("games.scopeMine")}
          </button>
          <button
            className={`segmented__item${scope === "all" ? " segmented__item--active" : ""}`}
            onClick={() => setScope("all")}
          >
            {t("games.scopeAll")}
          </button>
        </div>
      )}

      <div className="search-field" style={{ marginBottom: 14 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          placeholder={t("games.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      {types.length > 0 && (
        <div className="chip-row">
          <button
            className={`chip-filter${typeFilter === null ? " chip-filter--active" : ""}`}
            onClick={() => setTypeFilter(null)}
          >
            {t("games.typeAll")}
          </button>
          {types.map((type) => (
            <button
              key={type}
              className={`chip-filter${typeFilter === type ? " chip-filter--active" : ""}`}
              onClick={() => setTypeFilter(type)}
            >
              {t(`games.type.${type}`, type)}
            </button>
          ))}
        </div>
      )}

      <StatusView
        loading={loading || mineLoading}
        error={error ?? mineError}
        onRetry={() => {
          reload();
          if (scope === "mine") myGames.reload();
        }}
        empty={
          data && filtered.length === 0
            ? scope === "mine"
              ? t("games.emptyMine")
              : t("games.empty")
            : undefined
        }
      />

      {filtered.map((game) => (
        <GameRow
          key={game._id}
          game={game}
          browsable={online || downloaded.has(game.slug)}
        />
      ))}
    </div>
  );
}
