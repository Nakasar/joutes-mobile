import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchCards } from "../api/cards";
import type { Card } from "../api/types";
import { CardImage } from "./CardImage";
import { SearchIcon } from "./icons";
import { StatusView } from "./StatusView";

const PAGE_SIZE = 20;

/**
 * Choisir une carte du catalogue à ajouter à une zone du deck.
 *
 * L'éditeur du web garde le catalogue ouvert en permanence à gauche de
 * l'écran ; sur un téléphone il n'y a pas de « à gauche ». La recherche se
 * fait donc à la demande, une carte à la fois — c'est le geste d'ajustement,
 * celui d'après-tournoi. Construire un deck entier passe par la liste collée.
 */
export function DeckCardPickerSheet({
  gameSlugOrId,
  zoneLabel,
  onPick,
  onClose,
}: {
  gameSlugOrId: string;
  zoneLabel: string;
  onPick: (card: Card) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchCards(gameSlugOrId, { searchQuery: query || undefined, page, limit: PAGE_SIZE })
      .then((data) => {
        if (id !== requestId.current) return;
        setCards((previous) => (page === 1 ? data.cards : [...previous, ...data.cards]));
        setTotalPages(data.totalPages || 1);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlugOrId, query, page, t]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.edit.addTo", { zone: zoneLabel })}</h2>

          <div className="search-field" style={{ marginBottom: 12 }}>
            <SearchIcon size={18} />
            <input
              type="search"
              value={searchInput}
              placeholder={t("decks.edit.searchPlaceholder")}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
            />
          </div>

          {cards.map((card) => (
            <button
              key={card.id}
              className="list-row list-row--link"
              onClick={() => onPick(card)}
            >
              {card.image ? (
                <CardImage
                  src={card.image}
                  orientation={card.orientation}
                  alt=""
                  loading="lazy"
                  className="list-row__thumb"
                />
              ) : (
                <span className="list-row__thumb" />
              )}
              <div className="list-row__body">
                <p className="list-row__title">{card.name}</p>
                <p className="list-row__sub">
                  {[card.setCode, card.collectorNumber, card.type].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}

          <StatusView
            loading={loading}
            error={error}
            onRetry={() => setPage(1)}
            empty={!loading && !error && cards.length === 0 ? t("decks.edit.noCard") : undefined}
          />

          {!loading && !error && page < totalPages && (
            <button className="btn btn--grad load-more" onClick={() => setPage((p) => p + 1)}>
              {t("decks.loadMore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
