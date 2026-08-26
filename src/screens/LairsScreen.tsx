import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { searchLairs } from "../api/lairs";
import type { Lair } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { LairCard } from "../components/LairCard";
import { Movement } from "../components/Movement";
import { CaretIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { readOpeningState } from "../lib/lair-hours";

const PAGE_SIZE = 20;

const ALL = "all";

/**
 * L'annuaire des lieux.
 *
 * **Sans « autour de moi »**, alors que l'API sait le faire : lire la position
 * demande une permission native que l'application n'a pas déclarée, et un
 * bouton qui échouerait silencieusement vaut moins que pas de bouton. La
 * recherche par nom couvre le cas courant — on cherche une boutique dont on
 * connaît le nom —, et le filtre par jeu le reste.
 */
export function LairsScreen() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gameId, setGameId] = useState(ALL);

  const [lairs, setLairs] = useState<Lair[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Réessayer ne peut pas passer par la page : elle vaut déjà 1 quand la
  // première demande échoue, et la redemander ne relancerait rien.
  const [retry, setRetry] = useState(0);

  const games = useApi(() => listGames(), []);
  const gameName = useMemo(() => {
    const map = new Map<string, string>();
    for (const game of games.data ?? []) map.set(game._id, game.name);
    return map;
  }, [games.data]);

  // Le retour au premier palier se fait **avec** le changement de filtre, et non
  // dans un effet qui l'observe : un effet partirait après que la requête de ce
  // rendu-là est déjà lancée avec l'ancienne page, pour rien.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchLairs({
      search: search || undefined,
      gameId: gameId === ALL ? undefined : gameId,
      page,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        if (id !== requestId.current) return;
        setLairs((previous) => (page === 1 ? data.lairs : [...previous, ...data.lairs]));
        setTotalPages(data.totalPages || 1);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [search, gameId, page, retry, t]);

  const selectedGame = (games.data ?? []).find((game) => game._id === gameId);

  // Trois états, pas deux : ouvert, fermé, et **on ne sait pas**. Un lieu dont
  // la liste ne sert pas les horaires n'est pas un lieu fermé — le ranger sous
  // « fermés » annoncerait une fermeture qu'on ignore, et l'annuaire porte
  // aujourd'hui treize lieux sans horaires pour un qui en a.
  const stateOf = (lair: Lair) =>
    readOpeningState(lair.options?.openingHours, currentLocale()).isOpen;
  const openNow = lairs.filter((lair) => stateOf(lair) === true);
  const shutNow = lairs.filter((lair) => stateOf(lair) === false);
  const unknown = lairs.filter((lair) => stateOf(lair) === null);

  // Sans un seul horaire connu, il n'y a rien à partager : la liste reste d'un
  // seul tenant plutôt que de se donner un titre qui ne trie rien.
  const split = openNow.length + shutNow.length > 0;

  const card = (lair: Lair) => (
    <LairCard
      key={lair.id}
      lair={lair}
      gameNames={(lair.games ?? [])
        .map((id) => gameName.get(id))
        .filter((name): name is string => Boolean(name))}
    />
  );

  return (
    <div className="screen">
      <BackHeader title={t("lairs.title")} />

      <div className="search-field" style={{ marginBottom: 12 }}>
        <SearchIcon size={18} className="search-field__icon" />
        <input
          type="search"
          value={searchInput}
          placeholder={t("lairs.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <div className="filter-wrap">
        <div className="chip-row" style={{ marginBottom: 0 }}>
          {/* Le sélecteur natif, invisible, posé sur la puce : le choix passe
              par celui du système plutôt que par une liste à redessiner. */}
          <span
            className={`chip-filter chip-filter--select${gameId !== ALL ? " chip-filter--active" : ""}`}
          >
            {selectedGame?.name ?? t("lairs.filters.game")}
            <CaretIcon size={13} />
            <select
              className="chip-filter__native"
              value={gameId}
              aria-label={t("lairs.filters.game")}
              onChange={(e) => {
                setGameId(e.currentTarget.value);
                setPage(1);
              }}
            >
              <option value={ALL}>{t("lairs.filters.allGames")}</option>
              {(games.data ?? []).map((game) => (
                <option key={game._id} value={game._id}>
                  {game.name}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      {/* L'annuaire s'ouvre sur ce qui est ouvert : dans une liste de
          boutiques c'est la première question qu'on se pose, et elle se répond
          sans filtre. Les lieux dont on ignore les horaires ferment la marche
          sous leur propre titre — ils ne sont ni ouverts ni fermés, et les
          ranger d'un côté ou de l'autre serait leur prêter une heure. */}
      {split ? (
        <>
          {openNow.length > 0 && (
            <>
              <Movement
                section
                title={t("lairs.hours.openNow")}
                aside={t("lairs.count", { count: openNow.length })}
                asideTone="open"
              />
              {openNow.map(card)}
            </>
          )}
          {shutNow.length > 0 && (
            <>
              <Movement
                section
                title={t("lairs.hours.shutNow")}
                aside={t("lairs.count", { count: shutNow.length })}
              />
              {shutNow.map(card)}
            </>
          )}
          {unknown.length > 0 && (
            <>
              <Movement
                section
                title={t("lairs.hours.unknown")}
                aside={t("lairs.count", { count: unknown.length })}
              />
              {unknown.map(card)}
            </>
          )}
        </>
      ) : (
        lairs.map(card)
      )}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetry((r) => r + 1)}
        empty={!loading && !error && lairs.length === 0 ? t("lairs.empty") : undefined}
      />

      {!loading && !error && page < totalPages && (
        <button className="btn btn--grad load-more" onClick={() => setPage((p) => p + 1)}>
          {t("lairs.loadMore")}
        </button>
      )}
    </div>
  );
}
