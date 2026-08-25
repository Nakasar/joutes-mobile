import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { searchLairs } from "../api/lairs";
import type { Lair } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { LairCard } from "../components/LairCard";
import { SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

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

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, gameId]);

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

  return (
    <div className="screen">
      <BackHeader title={t("lairs.title")} />

      <div className="search-field" style={{ marginBottom: 12 }}>
        <SearchIcon size={18} />
        <input
          type="search"
          value={searchInput}
          placeholder={t("lairs.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <label className="field" style={{ marginBottom: 14 }}>
        <span className="field__label">{t("lairs.filters.game")}</span>
        <select value={gameId} onChange={(e) => setGameId(e.currentTarget.value)}>
          <option value={ALL}>{t("lairs.filters.allGames")}</option>
          {(games.data ?? []).map((game) => (
            <option key={game._id} value={game._id}>
              {game.name}
            </option>
          ))}
        </select>
      </label>

      {lairs.map((lair) => (
        <LairCard
          key={lair.id}
          lair={lair}
          gameNames={(lair.games ?? [])
            .map((id) => gameName.get(id))
            .filter((name): name is string => Boolean(name))}
        />
      ))}

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
