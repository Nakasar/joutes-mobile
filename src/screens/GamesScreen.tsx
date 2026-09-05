import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { getMyFollowedGameIds } from "../api/users";
import type { GameSummary } from "../api/types";
import { CachedImage } from "../components/CachedImage";
import { CheckIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { Tabs } from "../components/Tabs";
import { useApi } from "../hooks/useApi";
import { useOnline } from "../hooks/useOnline";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { GAME_TYPE_ORDER, gameTypeOrderIndex, isKnownGameType } from "../lib/game-types";
import { listMeta } from "../lib/offline-store";
import { useAuth } from "../store/auth";

/**
 * Une tuile de jeu.
 *
 * L'icône est le seul repère visuel qu'un jeu possède : en rangée pleine
 * largeur elle se noyait dans le texte, et neuf lignes se ressemblaient toutes.
 * Ici elle tient le haut de la tuile, posée sur un lavis de la couleur du jeu,
 * et il en tient deux par rangée — on reconnaît sa ligne avant de la lire.
 */
function GameTile({
  game,
  browsable,
  followed,
}: {
  game: GameSummary;
  browsable: boolean;
  followed: boolean;
}) {
  const { t } = useTranslation();
  const color = colorFor(game.slug, (game as { color?: string }).color);

  const inner = (
    <>
      <span
        className="game-tile__wash"
        style={{ background: `linear-gradient(180deg, ${color}24, transparent)` }}
      />
      <span className="game-tile__head">
        {game.icon ? (
          <CachedImage
            src={game.icon}
            alt=""
            className="game-tile__icon"
            loading="lazy"
          />
        ) : (
          <span className="game-tile__icon" style={tintStyle(color)}>
            {initialOf(game.name)}
          </span>
        )}
        {/* La coche dit ce que « Mes jeux » filtre, sans quitter la liste. */}
        {followed && (
          <span className="game-tile__followed" aria-label={t("games.scopeMine")}>
            <CheckIcon size={13} />
          </span>
        )}
      </span>

      <h2 className="game-tile__name">{game.name}</h2>
      {game.description && <p className="game-tile__desc">{game.description}</p>}

      {!browsable && (
        <span className="game-tile__note">
          <span className="chip">{t("games.unavailableOffline")}</span>
        </span>
      )}
    </>
  );

  if (!browsable) {
    // Jeu non téléchargé et appareil hors ligne : grisé et non cliquable.
    return (
      <div
        className="game-tile game-tile--offline"
        aria-disabled="true"
        title={t("games.offlineHint")}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link to={`/games/${game.slug}`} className="game-tile">
      {inner}
    </Link>
  );
}

const SCOPES = ["mine", "all"] as const;
type Scope = (typeof SCOPES)[number];

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

  // L'onglet vit dans l'URL pour survivre au retour arrière ; hors session il
  // n'y a qu'une liste, quoi que l'URL demande.
  const [requestedScope, setScope] = useSearchParamState<Scope>(
    "scope",
    SCOPES,
    isAuthenticated ? "mine" : "all",
  );
  const scope: Scope = isAuthenticated ? requestedScope : "all";
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

      {/* Deux listes, pas deux réglages : c'est de la navigation, elle prend
          les onglets — et rend au passage la hauteur d'une pastille. */}
      {showMineToggle && (
        <Tabs<Scope>
          current={scope}
          onSelect={setScope}
          items={[
            { key: "mine", label: t("games.scopeMine") },
            { key: "all", label: t("games.scopeAll") },
          ]}
        />
      )}

      <div className="search-field" style={{ marginBottom: 10 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          placeholder={t("games.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      {types.length > 0 && (
        <div className="filter-wrap" style={{ marginBottom: 12 }}>
          <div className="chip-row" style={{ marginBottom: 0 }}>
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

      <div className="game-grid">
        {filtered.map((game) => (
          <GameTile
            key={game._id}
            game={game}
            browsable={online || downloaded.has(game.slug)}
            // Dans « Mes jeux », tout est suivi : la coche n'y distinguerait
            // rien. Elle ne sert que dans le catalogue entier.
            followed={scope === "all" && myGameIds.has(game._id)}
          />
        ))}
      </div>
    </div>
  );
}
