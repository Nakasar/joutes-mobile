import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { searchCards } from "../api/cards";
import { getGame } from "../api/games";
import type { Card } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { BookIcon, DeckCheckIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 30;

/**
 * Galerie des cartes d'un jeu : recherche plein texte, filtres par set et
 * par type (facettes renvoyées par l'API), chargement par pages.
 */
export function GameCardsScreen() {
  const { gameSlug = "" } = useParams();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [setCode, setSetCode] = useState("");
  const [type, setType] = useState("");

  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [setCodes, setSetCodes] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Débounce de la saisie de recherche.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Toute modification des critères repart de la page 1.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, setCode, type, gameSlug]);

  const game = useApi(() => getGame(gameSlug), [gameSlug]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchCards(gameSlug, {
      searchQuery: searchQuery || undefined,
      setCode: setCode || undefined,
      type: type || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((response) => {
        if (id !== requestId.current) return;
        setCards((previous) =>
          page === 1 ? response.cards : [...previous, ...response.cards],
        );
        setTotal(response.total);
        setTotalPages(response.totalPages);
        if (response.setCodes) setSetCodes(response.setCodes);
        if (response.types) setTypes(response.types);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue.",
        );
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlug, searchQuery, setCode, type, page]);

  return (
    <div className="screen">
      <BackHeader
        title={game.data?.name ?? "Cartes"}
        action={
          <div className="head-actions">
            <Link
              to={`/games/${gameSlug}/deck-checker`}
              className="icon-button"
              aria-label="Vérificateur de deck"
              title="Vérificateur de deck"
            >
              <DeckCheckIcon size={20} />
            </Link>
            <Link
              to={`/games/${gameSlug}/rules`}
              className="header-link"
              aria-label="Consulter les règles"
            >
              <BookIcon size={16} />
              Règles
            </Link>
          </div>
        }
      />
      <div className="card-filters">
        <div className="search-field">
          <SearchIcon size={18} className="search-field__icon" />
          <input
            type="search"
            placeholder="Rechercher une carte…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
          />
        </div>
        <div className="card-filters__row">
          <select
            value={setCode}
            onChange={(e) => setSetCode(e.currentTarget.value)}
          >
            <option value="">Tous les sets</option>
            {setCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.currentTarget.value)}>
            <option value="">Tous les types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!loading && !error && (
        <p className="card-count">
          <strong>{total}</strong> carte{total > 1 ? "s" : ""}
        </p>
      )}
      <div className="card-grid">
        {cards.map((card) => (
          <Link
            key={card.id}
            to={`/games/${gameSlug}/cards/${card.id}`}
            className="card-tile"
          >
            <span className="card-tile__frame">
              {card.image ? (
                <img
                  src={card.image}
                  alt={card.name}
                  loading="lazy"
                  className="card-tile__image"
                />
              ) : (
                <span className="card-tile__placeholder">{card.name}</span>
              )}
              {typeof card.cost === "number" && (
                <span className="card-tile__cost">{card.cost}</span>
              )}
            </span>
            <span className="card-tile__name">{card.name}</span>
            {card.collectorNumber && (
              <span className="card-tile__set">
                {card.setCode} {card.collectorNumber}
              </span>
            )}
          </Link>
        ))}
      </div>
      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setPage(1)}
        empty={
          !loading && !error && cards.length === 0
            ? "Aucune carte ne correspond à la recherche."
            : undefined
        }
      />
      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((p) => p + 1)}
        >
          Charger plus
        </button>
      )}
    </div>
  );
}
