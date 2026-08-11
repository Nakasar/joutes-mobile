import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGame } from "../api/games";
import { getGameProducts, getProductCollection } from "../api/products";
import type {
  ProductCollectionItem,
  ProductCollectionStats,
} from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { BoxIcon, BrushIcon, MiniatureIcon, SearchIcon } from "../components/icons";
import { ProductSheet } from "../components/ProductSheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { PRODUCT_KIND_KEYS, suggestsRedundantPurchase } from "../lib/products";
import { useAuth } from "../store/auth";

const PAGE_SIZE = 24;

type Ownership = "all" | "owned" | "unowned";
type Shape = "all" | "containers" | "units";

/** Une des trois jauges de complétion d'une gamme. */
function CompletionBar({
  label,
  owned,
  total,
  icon,
}: {
  label: string;
  owned: number;
  total: number;
  icon: React.ReactNode;
}) {
  const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <div className="product-stat">
      <div className="product-stat__head">
        <span className="product-stat__icon">{icon}</span>
        <span className="product-stat__label">{label}</span>
        <span className="product-stat__value">
          {owned}/{total}
        </span>
      </div>
      <div className="progress">
        <div className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Catalogue des produits d'un jeu de figurines — boîtes, blisters, coffrets —
 * et la collection qui va avec.
 *
 * Le même écran sert connecté et déconnecté : sans session il n'y a rien à
 * marquer comme possédé, et l'écran invite à se connecter plutôt que d'afficher
 * des tuiles grises qui mentiraient. Les filtres « possédés » et « boîtes /
 * figurines » disparaissent alors : la route publique ne les connaît pas, et
 * les proposer sans effet vaudrait moins que de ne pas les proposer.
 */
export function GameProductsScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const { isAuthenticated } = useAuth();

  const game = useApi(() => getGame(gameSlug), [gameSlug]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [setCode, setSetCode] = useState("");
  const [kind, setKind] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [shape, setShape] = useState<Shape>("all");

  const [items, setItems] = useState<ProductCollectionItem[]>([]);
  const [stats, setStats] = useState<ProductCollectionStats | null>(null);
  const [setCodes, setSetCodes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [managed, setManaged] = useState<ProductCollectionItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, setCode, kind, ownership, shape, gameSlug]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const params = {
      search: searchQuery || undefined,
      setCode: setCode || undefined,
      kind: kind || undefined,
      page,
      limit: PAGE_SIZE,
    };

    const request = isAuthenticated
      ? getProductCollection(gameSlug, {
          ...params,
          owned:
            ownership === "owned"
              ? true
              : ownership === "unowned"
                ? false
                : undefined,
          containers:
            shape === "containers" ? true : shape === "units" ? false : undefined,
        })
      : getGameProducts(gameSlug, params);

    request
      .then((response) => {
        if (id !== requestId.current) return;
        setItems((previous) =>
          page === 1 ? response.items : [...previous, ...response.items],
        );
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setSetCodes(response.setCodes ?? []);
        if (response.stats !== undefined) setStats(response.stats);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("products.loadError"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [
    gameSlug,
    isAuthenticated,
    searchQuery,
    setCode,
    kind,
    ownership,
    shape,
    page,
    retryTick,
    t,
  ]);

  /**
   * Une modification sur un produit déborde de sa tuile : ajouter une figurine
   * change aussi la complétude des boîtes qui la contiennent, y compris hors de
   * l'écran, et les statistiques de la gamme. Les pages déjà chargées sont donc
   * relues à la fermeture de la fiche — une fois, plutôt qu'à chaque touche.
   */
  const dirty = useRef(false);
  const reloadLoadedPages = () => {
    const id = ++requestId.current;
    setLoading(true);
    Promise.all(
      Array.from({ length: page }, (_, index) =>
        getProductCollection(gameSlug, {
          search: searchQuery || undefined,
          setCode: setCode || undefined,
          kind: kind || undefined,
          owned:
            ownership === "owned"
              ? true
              : ownership === "unowned"
                ? false
                : undefined,
          containers:
            shape === "containers" ? true : shape === "units" ? false : undefined,
          page: index + 1,
          limit: PAGE_SIZE,
        }),
      ),
    )
      .then((responses) => {
        if (id !== requestId.current) return;
        setItems(responses.flatMap((response) => response.items));
        setTotal(responses[0].total);
        setTotalPages(responses[0].totalPages);
        if (responses[0].stats !== undefined) setStats(responses[0].stats);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("products.loadError"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };

  const closeSheet = () => {
    setManaged(null);
    if (dirty.current) {
      dirty.current = false;
      reloadLoadedPages();
    }
  };

  // Le filtre par gamme déplace la lecture des jauges : c'est la complétion de
  // la gamme choisie qui intéresse alors, pas celle du jeu entier.
  const activeSet =
    setCode && stats?.sets
      ? stats.sets.find((row) => row.setCode === setCode)
      : undefined;
  const productsOwned = activeSet?.productsOwned ?? stats?.productsOwned ?? 0;
  const productsTotal = activeSet?.productsTotal ?? stats?.productsTotal ?? 0;
  const unitsOwned = activeSet?.unitsOwned ?? stats?.unitsOwned ?? 0;
  const unitsTotal = activeSet?.unitsTotal ?? stats?.unitsTotal ?? 0;

  const filtered =
    searchQuery.length > 0 ||
    setCode.length > 0 ||
    kind.length > 0 ||
    ownership !== "all" ||
    shape !== "all";

  return (
    <div className="screen">
      <BackHeader title={game.data?.name ?? t("products.fallbackTitle")} />

      {stats && (
        <div className="card product-stats">
          <CompletionBar
            label={t("products.stats.catalog")}
            owned={productsOwned}
            total={productsTotal}
            icon={<BoxIcon size={16} />}
          />
          <CompletionBar
            label={t("products.stats.units")}
            owned={unitsOwned}
            total={unitsTotal}
            icon={<MiniatureIcon size={16} />}
          />
          <CompletionBar
            label={t("products.stats.paint")}
            owned={stats.paintedCopies}
            total={stats.paintableCopies}
            icon={<BrushIcon size={16} />}
          />
        </div>
      )}

      <div className="card-filters">
        <div className="search-field">
          <SearchIcon size={18} className="search-field__icon" />
          <input
            type="search"
            placeholder={t("products.filters.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
          />
        </div>
        <div className="card-filters__row">
          {setCodes.length > 0 && (
            <select
              value={setCode}
              onChange={(e) => setSetCode(e.currentTarget.value)}
            >
              <option value="">{t("products.filters.allSets")}</option>
              {setCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}
          <select value={kind} onChange={(e) => setKind(e.currentTarget.value)}>
            <option value="">{t("products.filters.allKinds")}</option>
            {PRODUCT_KIND_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`products.kinds.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {isAuthenticated && (
          <>
            <div className="segmented">
              {(["all", "containers", "units"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`segmented__item${shape === value ? " segmented__item--active" : ""}`}
                  onClick={() => setShape(value)}
                >
                  {t(`products.filters.shape.${value}`)}
                </button>
              ))}
            </div>
            <div className="segmented">
              {(["all", "owned", "unowned"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`segmented__item${ownership === value ? " segmented__item--active" : ""}`}
                  onClick={() => setOwnership(value)}
                >
                  {t(`products.filters.${value}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && !error && (
        <p className="card-count">
          <strong>{total}</strong> {t("products.countWord", { count: total })}
        </p>
      )}

      {!isAuthenticated && items.length > 0 && (
        <p className="status muted">
          {t("products.signedOutHint")}{" "}
          <Link to="/login">{t("common.signIn")}</Link>
        </p>
      )}

      <div className="product-grid">
        {items.map((item) => {
          const quantity = item.quantity ?? 0;
          const owned = quantity > 0;
          const isContainer = (item.content?.total ?? 0) > 0;
          const redundant = suggestsRedundantPurchase(item);
          const frameClass = `product-tile__frame${
            owned
              ? " product-tile__frame--owned"
              : redundant
                ? " product-tile__frame--redundant"
                : ""
          }`;
          return (
            <div key={item.id} className="product-tile">
              <button
                type="button"
                className={frameClass}
                disabled={!isAuthenticated}
                aria-label={t("products.tile.manage", { name: item.name })}
                onClick={() => setManaged(item)}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className={`product-tile__image${owned ? "" : " product-tile__image--unowned"}`}
                  />
                ) : (
                  <span className="product-tile__image product-tile__placeholder">
                    {isContainer ? (
                      <BoxIcon size={26} />
                    ) : (
                      <MiniatureIcon size={26} />
                    )}
                  </span>
                )}
                {owned && (
                  <span className="product-tile__badge">×{quantity}</span>
                )}
                {isContainer && item.content && (
                  <span
                    className={`product-tile__content${item.content.complete ? " product-tile__content--complete" : ""}`}
                  >
                    {item.content.owned}/{item.content.total}
                  </span>
                )}
              </button>
              <span className="card-tile__name">{item.name}</span>
              <span className="card-tile__set">
                {[item.setCode, t(`products.kinds.${item.kind}`)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          );
        })}
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetryTick((tick) => tick + 1)}
        empty={
          !loading && !error && items.length === 0
            ? filtered
              ? t("products.empty.noResults")
              : t("products.empty.noCatalog")
            : undefined
        }
      />

      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((current) => current + 1)}
        >
          {t("cards.loadMore")}
        </button>
      )}

      {managed && (
        <ProductSheet
          gameSlug={gameSlug}
          product={managed}
          onClose={closeSheet}
          onChanged={(quantity) => {
            // La fiche annonce la quantité dès son ouverture : seule une
            // valeur différente de celle de la tuile signale une modification.
            if ((managed.quantity ?? 0) !== quantity) dirty.current = true;
            setItems((previous) =>
              previous.map((item) =>
                item.id === managed.id ? { ...item, quantity } : item,
              ),
            );
          }}
        />
      )}
    </div>
  );
}
