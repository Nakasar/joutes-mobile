import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addCollectionCard,
  getGameCollection,
  recomputeGameCollectionValue,
  removeCollectionCard,
  undoCollectionBatch,
} from "../api/collection";
import type { CollectionItem, CollectionValue, SetCompletion } from "../api/types";
import { getGame } from "../api/games";
import { AddCollectionCopySheet } from "../components/AddCollectionCopySheet";
import { AddSetSheet } from "../components/AddSetSheet";
import { BackHeader } from "../components/BackHeader";
import { CardSearchBar } from "../components/CardSearchBar";
import { CollectionTransferSheet } from "../components/CollectionTransferSheet";
import { CardImage } from "../components/CardImage";
import { CardPriceTag } from "../components/CardPriceTag";
import { CollectionValueCard } from "../components/CollectionValueCard";
import { SetCompletionList } from "../components/SetCompletionList";
import {
  ArrowLeftRightIcon,
  BoxIcon,
  ChevronIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useCardSearchFields } from "../hooks/useCardSearchFields";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { COLLECTION_EXTRA_FIELDS } from "../lib/collection-search";
import { parseSearchSyntax } from "../lib/search-syntax";
import { withFieldToken } from "../lib/search-tokens";
import { resolvePrinting, type PrintingChoice } from "../lib/printings";
import { useAuth } from "../store/auth";

const PAGE_SIZE = 30;
const OWNERSHIPS = ["all", "owned", "unowned"] as const;
type Ownership = (typeof OWNERSHIPS)[number];

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
  // Même syntaxe que la galerie et le site, plus ce que seule la collection
  // comprend : `owned<3`, `foil:yes`, `cond:nm`.
  const fields = useCardSearchFields(gameSlug, COLLECTION_EXTRA_FIELDS);
  const shown = parseSearchSyntax(searchInput, fields);
  /** Ajout d'une extension, import / export : collection personnelle seulement. */
  const [sheet, setSheet] = useState<"addSet" | "transfer" | null>(null);
  /** Dernier ajout groupé, annulable d'un geste. */
  const [lastBatch, setLastBatch] = useState<{ batchId: string; label: string } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [ownership, setOwnership] = useSearchParamState<Ownership>("ownership", OWNERSHIPS, "all");

  const [gameName, setGameName] = useState("");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [gameOwned, setGameOwned] = useState(0);
  const [gameTotal, setGameTotal] = useState(0);
  const [masterOwned, setMasterOwned] = useState(0);
  const [masterTotal, setMasterTotal] = useState(0);
  const [gameValue, setGameValue] = useState<CollectionValue | undefined>();
  /** Exemplaires possédés, doublons compris : c'est sur eux que porte la valeur. */
  const [copies, setCopies] = useState(0);
  /** Avancement par extension, calculé avec le total du jeu. */
  const [setStats, setSetStats] = useState<SetCompletion[]>([]);
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
  }, [searchQuery, ownership, gameSlug, groupId]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    getGameCollection(
      gameSlug,
      {
        search: searchQuery || undefined,
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
          setGameValue(response.stats.value);
          setCopies(response.stats.copies);
          setSetStats(response.stats.sets ?? []);
        }
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("collection.browse.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [gameSlug, groupId, searchQuery, ownership, page, retryTick, t]);

  /** Recharge depuis la première page, après un ajout ou un import. */
  const reload = () => {
    setPage(1);
    setRetryTick((tick) => tick + 1);
  };

  const undoLastBatch = async () => {
    if (!lastBatch) return;
    setUndoing(true);
    try {
      const { removed } = await undoCollectionBatch(lastBatch.batchId);
      setLastBatch({ batchId: "", label: t("quickAdd.undone", { count: removed }) });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collection.browse.error"));
    } finally {
      setUndoing(false);
    }
  };

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
    setCopies((previous) => previous + 1);
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
      setCopies((previous) => previous - 1);
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
    setCopies((previous) => previous - 1);
    try {
      await removeCollectionCard(item.id, groupId);
    } catch (err) {
      applyQuantity(item.id, previousQuantity);
      applyStatsDelta({ ...item, quantity: previousQuantity - 1 }, 1);
      setCopies((previous) => previous + 1);
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

      {/* La valeur porte sur toute la collection de ce jeu, pas sur ce que le
          filtre montre : un total qui changerait avec un filtre ne se
          comparerait plus à rien. */}
      {gameTotal > 0 && (
        <CollectionValueCard
          value={gameValue}
          copies={copies}
          onRecompute={async () => {
            const { value } = await recomputeGameCollectionValue(gameSlug, groupId);
            setGameValue(value);
          }}
        />
      )}

      {gameTotal > 0 && (
        <SetCompletionList
          gameSlug={gameSlug}
          sets={setStats}
          activeSetCode={shown.setCode}
          onSelect={(code) =>
            setSearchInput(
              withFieldToken(
                searchInput,
                fields,
                "set",
                shown.setCode?.toUpperCase() === code.toUpperCase() ? "" : code,
              ),
            )
          }
        />
      )}

      {/* Les boosters ouverts, et le scan de leurs cartes : collection personnelle. */}
      {!groupId && (
        <Link to={`/collection/${gameSlug}/boosters`} className="list-row list-row--link">
          <span className="list-row__icon" style={{ background: "var(--chip)" }}>
            <ScanIcon size={20} style={{ color: "var(--primary)" }} />
          </span>
          <div className="list-row__body">
            <p className="list-row__title">{t("boosters.entry")}</p>
            <p className="list-row__sub">{t("boosters.entrySub")}</p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      )}

      {!groupId && (
        <div className="collection-actions">
          <button className="btn btn--grad" onClick={() => setSheet("addSet")}>
            <PlusIcon size={16} />
            {t("quickAdd.action")}
          </button>
          <button className="btn btn--outline" onClick={() => setSheet("transfer")}>
            <ArrowLeftRightIcon size={16} />
            {t("transfer.action")}
          </button>
        </div>
      )}

      {lastBatch && (
        <div className="undo-banner" role="status">
          <span className="undo-banner__text">{lastBatch.label}</span>
          {lastBatch.batchId ? (
            <button className="btn btn--ghost" onClick={undoLastBatch} disabled={undoing}>
              {t("quickAdd.undo")}
            </button>
          ) : (
            <button className="btn btn--ghost" onClick={() => setLastBatch(null)}>
              {t("common.close")}
            </button>
          )}
        </div>
      )}

      <div className="card-filters">
        <CardSearchBar
          value={searchInput}
          onChange={setSearchInput}
          fields={fields}
          placeholder={t("collection.browse.searchPlaceholder")}
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
                  <CardImage
                    src={item.image}
                    orientation={item.orientation}
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

      {sheet === "addSet" && (
        <AddSetSheet
          gameSlug={gameSlug}
          initialSetCode={shown.setCode}
          onClose={() => setSheet(null)}
          onAdded={(result) => {
            setSheet(null);
            setLastBatch(
              result.batchId
                ? { batchId: result.batchId, label: t("quickAdd.done", { count: result.copies }) }
                : null,
            );
            reload();
          }}
        />
      )}

      {sheet === "transfer" && (
        <CollectionTransferSheet
          gameSlug={gameSlug}
          search={searchQuery}
          onClose={() => setSheet(null)}
          onImported={(result) => {
            setSheet(null);
            setLastBatch({
              batchId: result.batchId ?? "",
              label: result.removed
                ? t("transfer.import.replaced", { count: result.added, removed: result.removed })
                : t("transfer.import.done", { count: result.added }),
            });
            reload();
          }}
        />
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
