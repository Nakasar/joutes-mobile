import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addCollectionCard,
  getGameCollection,
  removeCollectionCard,
} from "../api/collection";
import type { CollectionItem } from "../api/types";
import { getGame } from "../api/games";
import { AddCollectionCopySheet } from "../components/AddCollectionCopySheet";
import { BackHeader } from "../components/BackHeader";
import { CardPriceTag } from "../components/CardPriceTag";
import {
  BoxIcon,
  ChevronIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { resolvePrinting, type PrintingChoice } from "../lib/printings";
import { useAuth } from "../store/auth";

const PAGE_SIZE = 30;
type Ownership = "all" | "owned" | "unowned";

function CollectionGameContent({
  gameSlug,
  groupId,
}: {
  gameSlug: string;
  groupId?: string;
}) {
  const { t } = useTranslation();

  // Le catalogue de cartes ne dit pas si le jeu a aussi une gamme de produits :
  // seul le drapeau du jeu le sait.
  const game = useApi(() => getGame(gameSlug), [gameSlug]);
  const hasProducts = game.data?.features?.products === true;

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [setCode, setSetCode] = useState("");
  const [type, setType] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("all");

  const [gameName, setGameName] = useState("");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [gameOwned, setGameOwned] = useState(0);
  const [gameTotal, setGameTotal] = useState(0);
  const [masterOwned, setMasterOwned] = useState(0);
  const [masterTotal, setMasterTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [setCodes, setSetCodes] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCardIds, setBusyCardIds] = useState<Set<string>>(new Set());
  const [retryTick, setRetryTick] = useState(0);
  /** Carte dont on choisit la variante avant de l'ajouter, le cas échéant. */
  const [pickingPrinting, setPickingPrinting] = useState<CollectionItem | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, setCode, type, ownership, gameSlug, groupId]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    getGameCollection(
      gameSlug,
      {
        search: searchQuery || undefined,
        setCode: setCode || undefined,
        type: type || undefined,
        owned:
          ownership === "owned" ? true : ownership === "unowned" ? false : undefined,
        page,
        limit: PAGE_SIZE,
      },
      groupId,
    )
      .then((response) => {
        if (id !== requestId.current) return;
        setItems((previous) =>
          page === 1 ? response.items : [...previous, ...response.items],
        );
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setSetCodes(response.setCodes);
        setTypes(response.types);
        setGameName(response.game?.name ?? "");
        if (response.stats) {
          setGameOwned(response.stats.gameOwned);
          setGameTotal(response.stats.gameTotal);
          setMasterOwned(response.stats.masterOwned);
          setMasterTotal(response.stats.masterTotal);
        }
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("collection.browse.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlug, groupId, searchQuery, setCode, type, ownership, page, retryTick, t]);

  const applyQuantity = (cardId: string, quantity: number) => {
    setItems((previous) =>
      previous.map((it) => (it.id === cardId ? { ...it, quantity } : it)),
    );
  };

  const applyStatsDelta = (item: CollectionItem, delta: number) => {
    const wasOwned = item.quantity > 0;
    const willBeOwned = item.quantity + delta > 0;
    if (wasOwned === willBeOwned) return;
    const masterDelta = willBeOwned ? 1 : -1;
    setMasterOwned((prev) => prev + masterDelta);
    if (item.variantsOwned === 0) {
      setGameOwned((prev) => prev + masterDelta);
    }
  };

  const setBusy = (cardId: string, busy: boolean) => {
    setBusyCardIds((previous) => {
      const next = new Set(previous);
      if (busy) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  };

  /**
   * Ajoute un exemplaire. `choice` porte la variante retenue : la version de
   * base quand la carte n'a pas de variante, ou celle choisie dans la feuille.
   */
  const addOne = async (
    item: CollectionItem,
    choice: PrintingChoice = resolvePrinting(item),
  ) => {
    setBusy(item.id, true);
    const previousQuantity = item.quantity;
    applyStatsDelta(item, 1);
    applyQuantity(item.id, previousQuantity + 1);
    try {
      await addCollectionCard(
        {
          cardId: item.id,
          name: item.name,
          setCode: item.setCode,
          collectorNumber: item.collectorNumber,
          image: choice.image ?? item.image,
          ...(choice.foil && { foil: true }),
          ...(choice.printingId !== undefined && {
            printingId: choice.printingId,
            ...(choice.printingName !== undefined && {
              printingName: choice.printingName,
            }),
          }),
        },
        groupId,
      );
    } catch (err) {
      applyQuantity(item.id, previousQuantity);
      applyStatsDelta({ ...item, quantity: previousQuantity + 1 }, -1);
      setError(err instanceof Error ? err.message : t("collection.browse.error"));
    } finally {
      setBusy(item.id, false);
    }
  };

  const removeOne = async (item: CollectionItem) => {
    if (item.quantity <= 0) return;
    setBusy(item.id, true);
    const previousQuantity = item.quantity;
    applyStatsDelta(item, -1);
    applyQuantity(item.id, previousQuantity - 1);
    try {
      await removeCollectionCard(item.id, groupId);
    } catch (err) {
      applyQuantity(item.id, previousQuantity);
      applyStatsDelta({ ...item, quantity: previousQuantity - 1 }, 1);
      setError(err instanceof Error ? err.message : t("collection.browse.error"));
    } finally {
      setBusy(item.id, false);
    }
  };

  const percent = gameTotal > 0 ? Math.round((gameOwned / gameTotal) * 100) : 0;

  return (
    <div className="screen">
      <BackHeader title={gameName || t("collection.browse.fallbackTitle")} />

      {/* Un jeu peut avoir les deux : des cartes et une gamme de figurines.
          La collection de produits vit sur son propre écran — les unes se
          comptent en numéros de collection, l'autre en boîtes. */}
      {hasProducts && !groupId && (
        <Link
          to={`/collection/${gameSlug}/products`}
          className="list-row list-row--link"
        >
          <span className="list-row__icon" style={{ background: "var(--chip)" }}>
            <BoxIcon size={20} style={{ color: "var(--primary)" }} />
          </span>
          <div className="list-row__body">
            <p className="list-row__title">{t("collection.productsAction")}</p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      )}

      {gameTotal > 0 && (
        <div className="collection-game">
          <div className="collection-game__head">
            <div className="collection-game__body">
              <h2 className="collection-game__name">
                {t("collection.browse.stats", { owned: gameOwned, total: gameTotal })}
              </h2>
              <p className="collection-game__sub">
                {t("collection.browse.copies", {
                  owned: masterOwned,
                  total: masterTotal,
                })}
              </p>
            </div>
            <span className="collection-game__pct">{percent}%</span>
          </div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="card-filters">
        <div className="search-field">
          <input
            type="search"
            placeholder={t("collection.browse.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
          />
        </div>
        <div className="card-filters__row">
          <select value={setCode} onChange={(e) => setSetCode(e.currentTarget.value)}>
            <option value="">{t("cards.allSets")}</option>
            {setCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.currentTarget.value)}>
            <option value="">{t("cards.allTypes")}</option>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
        </div>
        <div className="segmented">
          <button
            className={`segmented__item${ownership === "all" ? " segmented__item--active" : ""}`}
            onClick={() => setOwnership("all")}
          >
            {t("collection.browse.filterAll")}
          </button>
          <button
            className={`segmented__item${ownership === "owned" ? " segmented__item--active" : ""}`}
            onClick={() => setOwnership("owned")}
          >
            {t("collection.browse.filterOwned")}
          </button>
          <button
            className={`segmented__item${ownership === "unowned" ? " segmented__item--active" : ""}`}
            onClick={() => setOwnership("unowned")}
          >
            {t("collection.browse.filterUnowned")}
          </button>
        </div>
      </div>

      {!loading && !error && (
        <p className="card-count">
          <strong>{total}</strong> {t("cards.countWord", { count: total })}
        </p>
      )}

      <div className="card-grid">
        {items.map((item) => {
          const owned = item.quantity > 0;
          const busy = busyCardIds.has(item.id);
          return (
            <div key={item.id} className="card-tile">
              <Link
                to={`/games/${gameSlug}/cards/${item.id}`}
                className={`card-tile__frame${item.foil ? " foil-shine" : ""}`}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className={`card-tile__image${owned ? "" : " card-tile__image--unowned"}`}
                  />
                ) : (
                  <span className="card-tile__placeholder">{item.name}</span>
                )}
                {owned && <span className="card-tile__badge">×{item.quantity}</span>}
              </Link>
              <span className="card-tile__name">{item.name}</span>
              <span className="card-tile__set">
                {item.setCode} {item.collectorNumber}
              </span>
              {/* Le prix se lit ici comme dans la galerie : c'est celui de la
                  carte au catalogue, pas celui de l'exemplaire possédé. */}
              <CardPriceTag price={item.marketPrice} />
              <div className="qty-stepper">
                <button
                  type="button"
                  className="qty-stepper__btn"
                  disabled={!owned || busy}
                  onClick={() => removeOne(item)}
                  aria-label={t("collection.browse.removeOne")}
                >
                  <MinusIcon size={14} />
                </button>
                <span className="qty-stepper__value">{item.quantity}</span>
                <button
                  type="button"
                  className="qty-stepper__btn"
                  disabled={busy}
                  onClick={() =>
                    // Une carte à variantes demande d'abord laquelle ajouter.
                    item.printings && item.printings.length > 0
                      ? setPickingPrinting(item)
                      : addOne(item)
                  }
                  aria-label={t("collection.browse.addOne")}
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetryTick((t) => t + 1)}
        empty={
          !loading && !error && items.length === 0
            ? t("collection.browse.empty")
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

      {pickingPrinting && (
        <AddCollectionCopySheet
          item={pickingPrinting}
          onClose={() => setPickingPrinting(null)}
          onConfirm={(choice) => {
            // La quantité affichée a pu bouger depuis l'ouverture : on repart
            // de l'élément courant plutôt que de l'instantané de la feuille.
            const current = items.find((it) => it.id === pickingPrinting.id);
            setPickingPrinting(null);
            if (current) void addOne(current, choice);
          }}
        />
      )}
    </div>
  );
}

/**
 * Parcours et édition (ajout/retrait d'exemplaires) de la collection d'un
 * jeu : la collection personnelle, ou celle partagée d'un play-group quand
 * l'écran est monté sous `/social/groups/:groupId/collection/:gameSlug`.
 */
export function CollectionGameScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { gameSlug = "", groupId } = useParams();

  if (!isAuthenticated) {
    return (
      <div className="screen">
        <BackHeader title={t("collection.browse.fallbackTitle")} />
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("collection.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return <CollectionGameContent gameSlug={gameSlug} groupId={groupId} />;
}
