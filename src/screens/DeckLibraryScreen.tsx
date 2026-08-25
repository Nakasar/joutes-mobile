import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listDeckLegends, searchDecks } from "../api/decks";
import { getGame, listGames } from "../api/games";
import type { Deck, DeckLegendFacet } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { DeckRow } from "../components/DeckRow";
import { SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 20;

/**
 * Les tris de la librairie.
 *
 * « Mes favoris » n'est pas un tri mais un filtre ; l'ordre y reste celui de la
 * fraîcheur, qui est ce qu'on attend d'une liste personnelle. Les trois vivent
 * ensemble parce que c'est un seul geste à l'écran — copie du raisonnement de
 * `lib/decks/library-filters.ts` côté web.
 */
const SORTS = ["popular", "recent", "favorites"] as const;
type Sort = (typeof SORTS)[number];

function sortParams(sort: Sort): {
  sortBy: "updatedAt" | "favoritesCount";
  favoritesOnly: boolean;
} {
  switch (sort) {
    case "recent":
      return { sortBy: "updatedAt", favoritesOnly: false };
    case "favorites":
      return { sortBy: "updatedAt", favoritesOnly: true };
    case "popular":
      return { sortBy: "favoritesCount", favoritesOnly: false };
  }
}

const ALL = "all";

export function DeckLibraryScreen() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gameId, setGameId] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [legendCardId, setLegendCardId] = useState("");
  const [sort, setSort] = useState<Sort>("popular");

  const [decks, setDecks] = useState<Deck[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const games = useApi(() => listGames(), []);
  // Les légendes ne se demandent qu'une fois un jeu choisi : sans lui, la
  // facette mélangerait les légendes de tous les jeux, ce qui ne filtre rien.
  const [legends, setLegends] = useState<DeckLegendFacet[]>([]);

  // Les formats sont déclarés par la fiche du jeu, que la liste des jeux ne
  // porte pas : il faut la demander, et seulement une fois un jeu choisi.
  const selectedGame = useApi(
    () => (gameId === ALL ? Promise.resolve(null) : getGame(gameId)),
    [gameId],
  );
  const formats = (selectedGame.data?.formats ?? [])
    .map((entry) => entry.name)
    .filter(Boolean);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, gameId, format, legendCardId, sort]);

  // Changer de jeu invalide la légende choisie : elle appartenait au jeu qu'on
  // vient de quitter, et la garder viderait silencieusement les résultats.
  useEffect(() => {
    setLegendCardId("");
    setFormat(ALL);
    if (gameId === ALL) {
      setLegends([]);
      return;
    }
    let cancelled = false;
    listDeckLegends(gameId)
      .then((data) => {
        if (!cancelled) setLegends(data);
      })
      .catch(() => {
        // Facette best-effort : sans elle le filtre disparaît, la librairie reste.
        if (!cancelled) setLegends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchDecks({
      scope: "public",
      search: search || undefined,
      gameId: gameId === ALL ? undefined : gameId,
      format: format === ALL ? undefined : format,
      legendCardId: legendCardId || undefined,
      page,
      limit: PAGE_SIZE,
      ...sortParams(sort),
    })
      .then((data) => {
        if (id !== requestId.current) return;
        setDecks((previous) => (page === 1 ? data.decks : [...previous, ...data.decks]));
        setTotalPages(data.totalPages || 1);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [search, gameId, format, legendCardId, sort, page, t]);

  return (
    <div className="screen">
      <BackHeader title={t("decks.library.title")} />

      <div className="search-field" style={{ marginBottom: 12 }}>
        <SearchIcon size={18} />
        <input
          type="search"
          value={searchInput}
          placeholder={t("decks.library.searchPlaceholder")}
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
            {t(`decks.sort.${key}`)}
          </button>
        ))}
      </div>

      <div className="deck-facets">
        <label className="field">
          <span className="field__label">{t("decks.facets.game")}</span>
          <select value={gameId} onChange={(e) => setGameId(e.currentTarget.value)}>
            <option value={ALL}>{t("decks.facets.allGames")}</option>
            {(games.data ?? []).map((game) => (
              <option key={game._id} value={game._id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        {formats.length > 0 && (
          <label className="field">
            <span className="field__label">{t("decks.facets.format")}</span>
            <select value={format} onChange={(e) => setFormat(e.currentTarget.value)}>
              <option value={ALL}>{t("decks.facets.allFormats")}</option>
              {formats.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

        {legends.length > 0 && (
          <label className="field">
            <span className="field__label">{t("decks.facets.legend")}</span>
            <select
              value={legendCardId}
              onChange={(e) => setLegendCardId(e.currentTarget.value)}
            >
              <option value="">{t("decks.facets.allLegends")}</option>
              {legends.map((legend) => (
                <option key={legend.cardId} value={legend.cardId}>
                  {legend.name} ({legend.count})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {decks.map((deck) => (
        <DeckRow key={deck.id} deck={deck} showAuthor />
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setPage(1)}
        empty={!loading && !error && decks.length === 0 ? t("decks.library.empty") : undefined}
      />

      {!loading && !error && page < totalPages && (
        <button className="btn btn--grad load-more" onClick={() => setPage((p) => p + 1)}>
          {t("decks.loadMore")}
        </button>
      )}
    </div>
  );
}
