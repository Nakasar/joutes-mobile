import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchCards } from "../../api/cards";
import { getGameCollection } from "../../api/collection";
import { getDeckCards } from "../../api/decks";
import { CardImage } from "../CardImage";
import { CardSearchBar } from "../CardSearchBar";
import { StatusView } from "../StatusView";
import { CheckIcon, MinusIcon, SparklesIcon } from "../icons";
import { OwnedBadge } from "./OwnedBadge";
import { useCardSearchFields } from "../../hooks/useCardSearchFields";
import { toDeckCardInfo } from "../../lib/deck-card-info";
import type { DeckCardInfo } from "../../lib/deck-contents";
import { AUTO_ZONE, type DeckTargetZone } from "../../lib/deck-routing";
import type { DeckZone, DeckZoneKey } from "../../lib/deck-zones";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const TOAST_MS = 3500;

/**
 * Ce qu'un ajout a produit : où la carte est allée et combien elle y en a, ou
 * pourquoi elle n'a pas pu entrer (zone pleine, plafond d'exemplaires).
 */
export type DeckCatalogAdd = { zone: DeckZoneKey; count: number } | { refused: string };

/**
 * Le catalogue de l'éditeur, en feuille haute : le pendant de la colonne de
 * gauche du site.
 *
 * Un toucher ajoute un exemplaire et la feuille **reste ouverte** — on enchaîne
 * les cartes comme on clique sur le site. La zone d'ajout « Auto » range chaque
 * carte selon son type ; en choisir une force la destination. Le « − » d'une
 * carte déjà dans le deck en retire un exemplaire, comme l'Alt-clic.
 */
export function DeckCatalogSheet({
  gameSlug,
  zones,
  target,
  onTargetChange,
  inDeck,
  onAdd,
  onUndo,
  ownedOf,
  onResults,
  hasCollection,
  sessionAdded,
  total,
  onClose,
}: {
  gameSlug: string;
  zones: DeckZone[];
  target: DeckTargetZone;
  onTargetChange: (target: DeckTargetZone) => void;
  /** Exemplaires de la carte dans le deck, toutes zones confondues. */
  inDeck: (cardId: string) => number;
  onAdd: (card: DeckCardInfo, delta: number) => DeckCatalogAdd | null;
  onUndo: (zone: DeckZoneKey, cardId: string) => void;
  ownedOf: (card: DeckCardInfo) => number | undefined;
  /** Les cartes affichées : l'écran les retient et compte leurs exemplaires possédés. */
  onResults: (cards: DeckCardInfo[]) => void;
  hasCollection: boolean;
  /** Exemplaires ajoutés depuis l'ouverture de la feuille. */
  sessionAdded: number;
  total: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const searchFields = useCardSearchFields(gameSlug);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [domainValues, setDomainValues] = useState<string[]>([]);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [cards, setCards] = useState<DeckCardInfo[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<
    { card: DeckCardInfo; added: { zone: DeckZoneKey; count: number } } | { refused: string } | null
  >(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    setPage(1);
  }, [query, domains, ownedOnly]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const inDomain = domains.length > 0 ? domains.join(",") : undefined;

    // « Possédées seulement » passe par la collection, qui ne rend pas le type
    // complet d'une carte : la route des cartes de deck le complète, sans quoi
    // le rangement automatique ne reconnaîtrait pas un champion.
    const load = ownedOnly
      ? getGameCollection(gameSlug, { search: query || undefined, owned: true, page, limit: PAGE_SIZE, inDomain }).then(
          async (data) => {
            const ids = data.items.map((item) => item.id);
            const infos = await getDeckCards(gameSlug, ids);
            const byId = new Map(infos.map((card) => [card.id, card]));
            return {
              cards: ids.map((cardId) => byId.get(cardId)).filter((card): card is DeckCardInfo => Boolean(card)),
              total: data.total,
              totalPages: data.totalPages,
              facets: undefined,
            };
          },
        )
      : searchCards(gameSlug, { searchQuery: query || undefined, in_domain: inDomain, page, limit: PAGE_SIZE }).then(
          (data) => ({
            cards: data.cards.map(toDeckCardInfo),
            total: data.total,
            totalPages: data.totalPages,
            facets: data.facets,
          }),
        );

    load
      .then((data) => {
        if (id !== requestId.current) return;
        setCards((previous) => (page === 1 ? data.cards : [...previous, ...data.cards]));
        setCount(data.total ?? 0);
        setTotalPages(data.totalPages || 1);
        onResults(data.cards);
        const facet = data.facets?.find((entry) => entry.key === "domain");
        // « Colorless » n'est pas un domaine qu'on filtre (comme sur le site).
        if (facet && facet.type === "value") setDomainValues(facet.values.filter((value) => value !== "Colorless"));
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // `onResults` change à chaque rendu de l'écran : le suivre relancerait la recherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSlug, query, domains, ownedOnly, page, retry, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(timer);
  }, [flash]);

  function add(card: DeckCardInfo) {
    const added = onAdd(card, 1);
    if (!added) return;
    if ("refused" in added) {
      setToast(added);
      return;
    }
    setFlash(card.id);
    setToast({ card, added });
  }

  function toggleDomain(domain: string) {
    setDomains((current) =>
      current.includes(domain) ? current.filter((value) => value !== domain) : [...current, domain],
    );
  }

  const activeZone = zones.find((zone) => zone.key === target);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet deck-catalog"
        role="dialog"
        aria-modal="true"
        aria-label={t("decks.editor.catalog.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="deck-catalog__body">
          <div className="deck-catalog__head">
            <h2 className="form-sheet__title">{t("decks.editor.catalog.title")}</h2>
            {!loading && <span className="muted">{t("decks.editor.catalog.results", { count })}</span>}
          </div>

          {/* Même syntaxe que la galerie : `domain:fury energy<=3`. */}
          <CardSearchBar value={input} onChange={setInput} fields={searchFields} />

          <div className="deck-catalog__chips">
            {hasCollection && (
              <button
                className={`chip-filter${ownedOnly ? " chip-filter--active" : ""}`}
                aria-pressed={ownedOnly}
                onClick={() => setOwnedOnly((value) => !value)}
              >
                {t("decks.editor.catalog.ownedOnly")}
              </button>
            )}
            {domainValues.map((domain) => (
              <button
                key={domain}
                className={`chip-filter${domains.includes(domain) ? " chip-filter--active" : ""}`}
                aria-pressed={domains.includes(domain)}
                onClick={() => toggleDomain(domain)}
              >
                {domain}
              </button>
            ))}
          </div>

          <p className="section-label" style={{ margin: 0 }}>
            {t("decks.editor.catalog.target")}
          </p>
          <div className="deck-catalog__chips">
            <button
              className={`chip-filter${target === AUTO_ZONE ? " chip-filter--active" : ""}`}
              aria-pressed={target === AUTO_ZONE}
              onClick={() => onTargetChange(AUTO_ZONE)}
            >
              <SparklesIcon size={12} strokeWidth={2.2} />
              {t("decks.editor.catalog.auto")}
            </button>
            {zones.map((zone) => (
              <button
                key={zone.key}
                className={`chip-filter${target === zone.key ? " chip-filter--active" : ""}`}
                aria-pressed={target === zone.key}
                onClick={() => onTargetChange(zone.key)}
              >
                {t(`decks.zones.${zone.key}`)}
              </button>
            ))}
          </div>
          <p className="deck-catalog__hint">
            {activeZone
              ? t("decks.editor.catalog.zoneHint", { zone: t(`decks.zones.${activeZone.key}`) })
              : t("decks.editor.catalog.autoHint")}
          </p>

          <div className="deck-catalog__grid">
            {cards.map((card) => {
              const held = inDeck(card.id);
              const owned = ownedOf(card);
              return (
                <div key={card.id} style={{ position: "relative", minWidth: 0 }}>
                  <button
                    className={`deck-catalog__card${flash === card.id ? " deck-catalog__card--flash" : ""}`}
                    onClick={() => add(card)}
                    aria-label={t("decks.editor.catalog.add", { name: card.name })}
                  >
                    <span className="deck-catalog__art">
                      {card.image ? (
                        <CardImage src={card.image} orientation={card.orientation} alt="" loading="lazy" />
                      ) : (
                        <span className="deck-edit-card__placeholder">{card.name}</span>
                      )}
                      {owned !== undefined && <OwnedBadge owned={owned} />}
                    </span>
                    <span className="deck-catalog__text">
                      <span className="deck-catalog__name">{card.name}</span>
                      <span className="deck-catalog__sub">
                        {[card.type, card.cost !== undefined ? String(card.cost) : undefined]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {held > 0 && (
                    <span className="deck-catalog__indeck">
                      {held}
                      <button
                        className="deck-catalog__minus"
                        onClick={() => onAdd(card, -1)}
                        aria-label={t("decks.editor.catalog.remove", { name: card.name })}
                      >
                        <MinusIcon size={12} strokeWidth={2.6} />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <StatusView
            loading={loading}
            error={error}
            onRetry={() => setRetry((value) => value + 1)}
            empty={!loading && !error && cards.length === 0 ? t("decks.editor.catalog.noCard") : undefined}
          />

          {!loading && !error && page < totalPages && (
            <button className="btn btn--outline btn--block" onClick={() => setPage((value) => value + 1)}>
              {t("decks.loadMore")}
            </button>
          )}
        </div>

        {toast && "refused" in toast && (
          <div className="deck-catalog__toast deck-catalog__toast--refused" role="alert">
            <span>{toast.refused}</span>
          </div>
        )}
        {toast && !("refused" in toast) && (
          <div className="deck-catalog__toast" role="status">
            <CheckIcon size={16} strokeWidth={2.4} />
            <span>
              {t("decks.editor.catalog.added", {
                name: toast.card.name,
                zone: t(`decks.zones.${toast.added.zone}`),
                count: toast.added.count,
              })}
            </span>
            <button
              onClick={() => {
                onUndo(toast.added.zone, toast.card.id);
                setToast(null);
              }}
            >
              {t("decks.editor.catalog.undo")}
            </button>
          </div>
        )}

        <div className="deck-catalog__foot">
          <p>
            {sessionAdded !== 0 ? (
              <b>{t("decks.editor.catalog.sessionAdded", { count: sessionAdded, signed: sessionAdded > 0 ? `+${sessionAdded}` : String(sessionAdded) })}</b>
            ) : (
              t("decks.editor.catalog.sessionNone")
            )}
            <br />
            {t("decks.editor.catalog.total", { count: total })}
          </p>
          <button className="btn btn--grad" onClick={onClose}>
            {t("decks.editor.catalog.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
