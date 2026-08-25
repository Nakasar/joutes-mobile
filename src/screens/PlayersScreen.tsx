import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { getLeaderboard, searchPlayers } from "../api/users";
import type { RegistryEntry, RegistrySort } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { PlayerRow } from "../components/PlayerRow";
import { SearchIcon, TrophyIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userLabel, userProfilePath } from "../lib/user-tag";
import { CachedImage } from "../components/CachedImage";
import { Link } from "react-router-dom";

/**
 * Le pas et le plafond du registre, repris de `lib/users/registry-search.ts`.
 *
 * `count` est un **compteur cumulé**, pas un numéro de page : chaque appel rend
 * la liste depuis le début, et « charger plus » demande vingt de plus. Le
 * serveur arrondit et plafonne de son côté ; les garder ici évite d'envoyer une
 * demande qu'on sait inutile.
 */
const REGISTRY_STEP = 20;
const REGISTRY_MAX_COUNT = 100;

const SORTS = ["active", "followers", "name"] as const;

const ALL = "all";

type Tab = "registry" | "leaderboard";

function Leaderboard() {
  const { t } = useTranslation();
  const board = useApi(() => getLeaderboard(), []);
  const rows = board.data?.rows ?? [];
  const rank = board.data?.rank;

  return (
    <>
      <StatusView
        loading={board.loading}
        error={board.error}
        onRetry={board.reload}
        empty={board.data && rows.length === 0 ? t("players.leaderboard.empty") : undefined}
      />

      {rank && (
        <div className="card leaderboard__rank">
          <p className="leaderboard__rank-title">
            {t("players.leaderboard.yourRank", { rank: rank.rank, total: rank.total })}
          </p>
          <p className="list-row__sub">
            {t("players.leaderboard.score", {
              points: rank.points,
              count: rank.unlocked,
            })}
          </p>
        </div>
      )}

      {rows.map((row, index) => {
        const user = row.user;
        if (!user) return null;
        const label = userLabel(user);

        return (
          <Link
            key={row.userId}
            to={userProfilePath(user)}
            className="list-row list-row--link"
          >
            <span className="leaderboard__place">{index + 1}</span>
            {user.avatar ? (
              <CachedImage src={user.avatar} alt="" className="avatar" />
            ) : (
              <span className="avatar" style={tintStyle(colorFor(user.id))}>
                {initialOf(label)}
              </span>
            )}
            <div className="list-row__body">
              <p className="list-row__title">{label}</p>
              <p className="list-row__sub">
                {t("players.leaderboard.score", {
                  points: row.points,
                  count: row.unlocked,
                })}
              </p>
            </div>
          </Link>
        );
      })}
    </>
  );
}

function Registry() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [gameId, setGameId] = useState(ALL);
  const [sells, setSells] = useState(false);
  const [live, setLive] = useState(false);
  const [sort, setSort] = useState<RegistrySort>("active");

  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(REGISTRY_STEP);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // « Réessayer » ne peut pas passer par `count` : au premier palier — le cas
  // courant d'un échec — le redemander ne changerait rien, et le bouton ne
  // relancerait donc rien.
  const [retry, setRetry] = useState(0);

  const games = useApi(() => listGames(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCity(cityInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, cityInput]);

  // Changer un filtre repart du premier palier : garder cent résultats demandés
  // ferait payer une recherche large à une recherche qui vient de se resserrer.
  useEffect(() => {
    setCount(REGISTRY_STEP);
  }, [search, city, gameId, sells, live, sort]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchPlayers({
      q: search || undefined,
      gameId: gameId === ALL ? undefined : gameId,
      city: city || undefined,
      sells,
      live,
      sort,
      count,
    })
      .then((data) => {
        if (id !== requestId.current) return;
        // Chaque appel rend la liste entière : on remplace, on ne concatène
        // pas — concaténer doublerait les fiches déjà affichées.
        setEntries(data.entries);
        setTotal(data.total);
        setHasMore(data.hasMore);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [search, city, gameId, sells, live, sort, count, retry, t]);

  return (
    <>
      <div className="search-field" style={{ marginBottom: 12 }}>
        <SearchIcon size={18} />
        <input
          type="search"
          value={searchInput}
          placeholder={t("players.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <div className="segmented" style={{ marginBottom: 12 }}>
        {SORTS.map((key) => (
          <button
            key={key}
            className={`segmented__item${sort === key ? " segmented__item--active" : ""}`}
            onClick={() => setSort(key)}
          >
            {t(`players.sort.${key}`)}
          </button>
        ))}
      </div>

      <div className="registry-filters">
        <label className="field">
          <span className="field__label">{t("players.filters.game")}</span>
          <select value={gameId} onChange={(e) => setGameId(e.currentTarget.value)}>
            <option value={ALL}>{t("players.filters.allGames")}</option>
            {(games.data ?? []).map((game) => (
              <option key={game._id} value={game._id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        {/* « Proches de moi » du web demande la ville du compte, que l'API ne
            rend pas : la ville se tape, ce qui couvre aussi la recherche
            d'ailleurs qu'à côté de chez soi. */}
        <label className="field">
          <span className="field__label">{t("players.filters.city")}</span>
          <input
            type="text"
            value={cityInput}
            placeholder={t("players.filters.cityPlaceholder")}
            onChange={(e) => setCityInput(e.currentTarget.value)}
          />
        </label>
      </div>

      <div className="chip-set registry-filters__toggles">
        <button
          className={`chip-filter${live ? " chip-filter--active" : ""}`}
          onClick={() => setLive((v) => !v)}
          aria-pressed={live}
        >
          {t("players.filters.live")}
        </button>
        <button
          className={`chip-filter${sells ? " chip-filter--active" : ""}`}
          onClick={() => setSells((v) => !v)}
          aria-pressed={sells}
        >
          {t("players.filters.sells")}
        </button>
      </div>

      {!loading && !error && entries.length > 0 && (
        <p className="section-label">{t("players.results", { count: total })}</p>
      )}

      {entries.map((entry) => (
        <PlayerRow key={entry.user.id} entry={entry} />
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetry((r) => r + 1)}
        empty={!loading && !error && entries.length === 0 ? t("players.empty") : undefined}
      />

      {!loading && !error && hasMore && count < REGISTRY_MAX_COUNT && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setCount((c) => Math.min(c + REGISTRY_STEP, REGISTRY_MAX_COUNT))}
        >
          {t("players.loadMore")}
        </button>
      )}
    </>
  );
}

/**
 * Le registre de la communauté — « Joueurs ».
 *
 * Deux entrées d'un même écran : qui joue à quoi et où, et qui a décroché quoi.
 * Le classement n'est pas un tri du registre — c'est une autre liste, plus
 * courte, sans filtres — d'où l'onglet plutôt qu'une quatrième pastille de tri.
 */
export function PlayersScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("registry");

  return (
    <div className="screen">
      <BackHeader title={t("players.title")} />

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={`segmented__item${tab === "registry" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("registry")}
        >
          {t("players.tabRegistry")}
        </button>
        <button
          className={`segmented__item${tab === "leaderboard" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("leaderboard")}
        >
          <TrophyIcon size={14} />
          {t("players.tabLeaderboard")}
        </button>
      </div>

      {tab === "registry" ? <Registry /> : <Leaderboard />}
    </div>
  );
}
