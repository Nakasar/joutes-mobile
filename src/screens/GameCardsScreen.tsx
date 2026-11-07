import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchCards } from "../api/cards";
import { getGame } from "../api/games";
import type { Card } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CardImage } from "../components/CardImage";
import { CardPriceTag } from "../components/CardPriceTag";
import { CardSearchBar } from "../components/CardSearchBar";
import { BookIcon, DeckCheckIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useCardSearchFields } from "../hooks/useCardSearchFields";
import { parseSearchSyntax } from "../lib/search-syntax";
import { withFieldToken } from "../lib/search-tokens";

const PAGE_SIZE = 30;

/**
 * Galerie des cartes d'un jeu : recherche avec la syntaxe du site
 * (`domain:fury energy<=3 set:OGN`), que le serveur relit lui-même, et
 * chargement par pages. Les listes de set et de type écrivent dans la barre.
 */
export function GameCardsScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fields = useCardSearchFields(gameSlug);
  const shown = parseSearchSyntax(searchInput, fields);

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
  }, [searchQuery, gameSlug]);

  const game = useApi(() => getGame(gameSlug), [gameSlug]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchCards(gameSlug, {
      searchQuery: searchQuery || undefined,
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
        setError(err instanceof Error ? err.message : t("cards.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlug, searchQuery, page]);

  return (
    <div className="screen">
      <BackHeader
        title={game.data?.name ?? t("cards.fallbackTitle")}
        action={
          <div className="head-actions">
            <Link
              to={`/games/${gameSlug}/deck-checker`}
              className="icon-button"
              aria-label={t("cards.deckChecker")}
              title={t("cards.deckChecker")}
            >
              <DeckCheckIcon size={20} />
            </Link>
            <Link
              to={`/games/${gameSlug}/rules`}
              className="header-link"
              aria-label={t("cards.rulesAria")}
            >
              <BookIcon size={16} />
              {t("cards.rulesLink")}
            </Link>
          </div>
        }
      />
      <div className="card-filters">
        <CardSearchBar
          value={searchInput}
          onChange={setSearchInput}
          fields={fields}
        />
        <div className="card-filters__row">
          <select
            value={shown.setCode ?? ""}
            onChange={(e) =>
              setSearchInput(withFieldToken(searchInput, fields, "set", e.currentTarget.value))
            }
          >
            <option value="">{t("cards.allSets")}</option>
            {setCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select
            value={shown.type ?? ""}
            onChange={(e) =>
              setSearchInput(withFieldToken(searchInput, fields, "type", e.currentTarget.value))
            }
          >
            <option value="">{t("cards.allTypes")}</option>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!loading && !error && (
        <p className="card-count">
          <strong>{total}</strong> {t("cards.countWord", { count: total })}
        </p>
      )}
      <div className="card-grid">
        {cards.map((card) => (
          <Link
            key={card.id}
            to={`/games/${gameSlug}/cards/${card.id}`}
            className="card-tile"
          >
            {/* Une carte toujours foil se reconnaît dans la galerie comme sur sa fiche. */}
            <span
              className={`card-tile__frame${card.foil ? " foil-shine" : ""}`}
            >
              {card.image ? (
                <CardImage
                  src={card.image}
                  orientation={card.orientation}
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
            {/* Une carte sans relevé n'affiche rien : un tiret se lirait
                comme un prix nul. */}
            <CardPriceTag price={card.marketPrice} />
          </Link>
        ))}
      </div>
      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setPage(1)}
        empty={
          !loading && !error && cards.length === 0
            ? t("cards.empty")
            : undefined
        }
      />
      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((p) => p + 1)}
        >
          {t("cards.loadMore")}
        </button>
      )}
    </div>
  );
}
