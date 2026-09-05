import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { getLeaderboard, searchPlayers } from "../api/users";
import type { LeaderboardRow, RegistryEntry, RegistrySort } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { PlayerRow } from "../components/PlayerRow";
import { Tabs } from "../components/Tabs";
import { CaretIcon, SearchIcon, TrophyIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useSearchParamState } from "../hooks/useSearchParamState";
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

/** Les trois premiers du classement, montrés ensemble plutôt qu'en rangées. */
const PODIUM_SIZE = 3;

/**
 * Or, argent, bronze : l'anneau du podium, et rien d'autre.
 *
 * L'or est le jeton du thème, pas un hexadécimal : il suit le mode sombre. Il
 * ne se dilue donc pas par un suffixe alpha collé au bout — `var(--gold)33`
 * n'est pas une couleur, et la première marche perdait son fond en silence.
 * `color-mix` accepte les deux formes.
 */
const MEDALS = ["var(--gold)", "#9aa9b4", "#b06b3a"];

/** Le fond d'un anneau : la médaille, très diluée. */
function ringOf(medal: string): string {
  return `color-mix(in srgb, ${medal} 20%, transparent)`;
}

const TABS = ["registry", "leaderboard"] as const;
type Tab = (typeof TABS)[number];

function BoardAvatar({ row, className }: { row: LeaderboardRow; className: string }) {
  const user = row.user;
  const label = user ? userLabel(user) : "?";

  if (user?.avatar) {
    return <CachedImage src={user.avatar} alt="" className={className} />;
  }
  return (
    <span className={className} style={tintStyle(colorFor(row.userId))}>
      {initialOf(label)}
    </span>
  );
}

/**
 * Le classement des succès.
 *
 * Les trois premiers ont leur podium : un classement dont la tête se lit comme
 * les lignes quatre à vingt n'est plus un classement, c'est une liste triée. Le
 * reste garde la rangée compacte, avec son rang à gauche.
 */
function Leaderboard() {
  const { t } = useTranslation();
  const board = useApi(() => getLeaderboard(), []);
  const rows = (board.data?.rows ?? []).filter((row) => row.user);
  const rank = board.data?.rank;

  const podium = rows.slice(0, PODIUM_SIZE);
  const rest = rows.slice(PODIUM_SIZE);

  // Le premier au milieu, le deuxième à sa gauche : c'est la forme d'un podium,
  // et elle se lit sans lire les rangs.
  const ordered = podium.length === PODIUM_SIZE ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <>
      <StatusView
        loading={board.loading}
        error={board.error}
        onRetry={board.reload}
        empty={board.data && rows.length === 0 ? t("players.leaderboard.empty") : undefined}
      />

      {rank && (
        <div className="rank-card">
          <p>
            <span className="rank-card__place">{rank.rank}</span>
            <span className="rank-card__of"> / {rank.total}</span>
          </p>
          <div>
            <p className="section-label" style={{ margin: 0 }}>
              {t("players.leaderboard.yourRankLabel")}
            </p>
            <p className="rank-card__score">
              {t("players.leaderboard.score", { points: rank.points, count: rank.unlocked })}
            </p>
          </div>
        </div>
      )}

      {ordered.length > 0 && (
        <div className="podium">
          {ordered.map((row) => {
            const place = podium.indexOf(row) + 1;
            const medal = MEDALS[place - 1];

            return (
              <Link
                key={row.userId}
                to={row.user ? userProfilePath(row.user) : "#"}
                className={`podium__cell${place === 1 ? " podium__cell--first" : ""}`}
              >
                <span className="podium__ring" style={{ background: ringOf(medal) }}>
                  <BoardAvatar row={row} className="avatar" />
                </span>
                <span className="podium__place" style={{ color: medal }}>
                  #{place}
                </span>
                <span className="podium__name">{row.user ? userLabel(row.user) : ""}</span>
                <span className="podium__pts">
                  {t("players.leaderboard.points", { count: row.points })}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {rest.map((row, index) => (
        <Link
          key={row.userId}
          to={row.user ? userProfilePath(row.user) : "#"}
          className="board-row"
        >
          <span className="board-row__place">{PODIUM_SIZE + index + 1}</span>
          <BoardAvatar row={row} className="avatar" />
          <div className="board-row__body">
            <p className="board-row__name">{row.user ? userLabel(row.user) : ""}</p>
            <p className="board-row__sub">
              {t("players.leaderboard.unlocked", { count: row.unlocked })}
            </p>
          </div>
          <span className="board-row__pts">
            {t("players.leaderboard.points", { count: row.points })}
          </span>
        </Link>
      ))}
    </>
  );
}

/**
 * Le registre proprement dit.
 *
 * **Les filtres tiennent sur une rangée.** Empilés — tri segmenté, liste de
 * jeux, champ ville, deux bascules — ils repoussaient la première fiche à plus
 * de cinq cents pixels du haut : deux joueurs à l'écran, sur un registre qui en
 * compte des centaines. Ils passent donc en puces défilantes, et le tri à droite
 * du compteur de résultats.
 *
 * Une puce non réglée porte le nom de sa dimension — « Jeu », « Ville » — et
 * non sa valeur « tout » : c'est deux fois plus court, et c'est à ce prix que
 * les quatre filtres tiennent dans la largeur d'un téléphone.
 */
function Registry() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
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

  // Changer un filtre repart du premier palier : garder cent résultats demandés
  // ferait payer une recherche large à une recherche qui vient de se resserrer.
  //
  // Le retour se fait **avec** le changement, et non dans un effet qui
  // l'observe : un effet ne part qu'après la requête du rendu en cours,
  // laquelle est déjà partie avec l'ancien palier. Deux requêtes pour un seul
  // geste, dont une jetée à l'arrivée.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCity(cityInput.trim());
      setCount(REGISTRY_STEP);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, cityInput]);

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

  const selectedGame = (games.data ?? []).find((game) => game._id === gameId);

  return (
    <>
      <div className="search-field" style={{ marginBottom: 10 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          value={searchInput}
          placeholder={t("players.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <div className="filter-wrap">
        <div className="chip-row" style={{ marginBottom: 0 }}>
          {/* Le sélecteur natif, invisible, est posé sur la puce : le choix d'un
              jeu passe par le sélecteur du système plutôt que par une liste
              déroulante à redessiner — et il reste accessible au clavier. */}
          <span
            className={`chip-filter chip-filter--select${gameId !== ALL ? " chip-filter--active" : ""}`}
          >
            {selectedGame?.name ?? t("players.filters.game")}
            <CaretIcon size={13} />
            <select
              className="chip-filter__native"
              value={gameId}
              aria-label={t("players.filters.game")}
              onChange={(e) => {
                setGameId(e.currentTarget.value);
                setCount(REGISTRY_STEP);
              }}
            >
              <option value={ALL}>{t("players.filters.allGames")}</option>
              {(games.data ?? []).map((game) => (
                <option key={game._id} value={game._id}>
                  {game.name}
                </option>
              ))}
            </select>
          </span>

          {/* « Proches de moi » du web demande la ville du compte, que l'API ne
              rend pas : la ville se tape, ce qui couvre aussi la recherche
              d'ailleurs qu'à côté de chez soi. Le champ se déplie sous la
              rangée — pleine largeur, parce qu'on y écrit. */}
          <button
            className={`chip-filter chip-filter--select${city ? " chip-filter--active" : ""}`}
            aria-expanded={cityOpen}
            onClick={() => setCityOpen((open) => !open)}
          >
            {city || t("players.filters.city")}
            <CaretIcon size={13} />
          </button>

          <button
            className={`chip-filter${live ? " chip-filter--active" : ""}`}
            onClick={() => {
              setLive((v) => !v);
              setCount(REGISTRY_STEP);
            }}
            aria-pressed={live}
          >
            {t("players.filters.live")}
          </button>
          <button
            className={`chip-filter${sells ? " chip-filter--active" : ""}`}
            onClick={() => {
              setSells((v) => !v);
              setCount(REGISTRY_STEP);
            }}
            aria-pressed={sells}
          >
            {t("players.filters.sells")}
          </button>
        </div>
      </div>

      {cityOpen && (
        <div className="filter-panel">
          <input
            type="text"
            autoFocus
            value={cityInput}
            placeholder={t("players.filters.cityPlaceholder")}
            onChange={(e) => setCityInput(e.currentTarget.value)}
          />
          {cityInput && (
            <button className="btn btn--outline" onClick={() => setCityInput("")}>
              {t("players.filters.clear")}
            </button>
          )}
        </div>
      )}

      {/* Les ordres du registre, posés sur la ligne du compteur : trois mots
          soulignés valent un menu déroulant, et se lisent sans l'ouvrir. */}
      <div className="orders" role="group" aria-label={t("players.sortAction")}>
        <div className="orders__set">
          {SORTS.map((key) => (
            <button
              key={key}
              aria-pressed={sort === key}
              onClick={() => {
                setSort(key);
                setCount(REGISTRY_STEP);
              }}
            >
              {t(`players.sort.${key}`)}
            </button>
          ))}
        </div>
        <span className="orders__count">
          {!loading && !error && entries.length > 0 ? t("players.results", { count: total }) : ""}
        </span>
      </div>

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
  const [tab, setTab] = useSearchParamState<Tab>("tab", TABS, "registry");

  return (
    <div className="screen">
      <BackHeader title={t("players.title")} />

      <Tabs<Tab>
        current={tab}
        onSelect={setTab}
        items={[
          { key: "registry", label: t("players.tabRegistry") },
          {
            key: "leaderboard",
            label: (
              <>
                <TrophyIcon size={14} />
                {t("players.tabLeaderboard")}
              </>
            ),
          },
        ]}
      />

      {tab === "registry" ? <Registry /> : <Leaderboard />}
    </div>
  );
}
