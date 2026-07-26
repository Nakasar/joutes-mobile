import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchTradeCards } from "../api/trades";
import type { TradeCard, TradeCardScope, TradeCardSearchResult } from "../api/types";
import { PlusIcon, SearchIcon } from "./icons";
import { StatusView } from "./StatusView";

const PAGE_SIZE = 20;

/**
 * Recherche de cartes à ajouter à une offre d'échange (collection ou
 * catalogue, tous jeux confondus) — modale sur `GET /trades/cards`.
 */
export function TradeCardPickerSheet({
  defaultScope,
  requireOwned = false,
  requireCardId = false,
  selectedQuantities,
  onAdd,
  onClose,
}: {
  defaultScope: TradeCardScope;
  /** Vrai pour sa propre offre : une carte non possédée n'est pas proposable. */
  requireOwned?: boolean;
  /** Vrai pour une contrepartie libre : la carte doit être connue du catalogue. */
  requireCardId?: boolean;
  selectedQuantities: Map<string, number>;
  onAdd: (card: TradeCard) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<TradeCardScope>(defaultScope);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TradeCardSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query, scope]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchTradeCards({ scope, q: query || undefined, page, limit: PAGE_SIZE })
      .then((data) => {
        if (id !== requestId.current) return;
        setResult(data);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [scope, query, page, t]);

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;

  function blockedReason(card: TradeCard): string | null {
    if (requireOwned && card.owned <= 0) return t("trades.panel.notOwned");
    if (requireCardId && !card.cardId) return t("trades.panel.notInCatalog");
    if (requireOwned && (selectedQuantities.get(card.key) ?? 0) >= card.owned) {
      return t("trades.panel.allCopiesSelected");
    }
    return null;
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("trades.panel.addTitle")}</h2>

          <div className="segmented" style={{ marginBottom: 12 }}>
            <button
              className={`segmented__item${scope === "collection" ? " segmented__item--active" : ""}`}
              onClick={() => setScope("collection")}
            >
              {t("trades.panel.scopeCollection")}
            </button>
            <button
              className={`segmented__item${scope === "catalog" ? " segmented__item--active" : ""}`}
              onClick={() => setScope("catalog")}
            >
              {t("trades.panel.scopeCatalog")}
            </button>
          </div>

          <div className="search-field" style={{ marginBottom: 12 }}>
            <SearchIcon size={18} className="search-field__icon" />
            <input
              type="search"
              placeholder={t("trades.panel.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              autoFocus
            />
          </div>

          {result?.needsQuery ? (
            <p className="status muted">{t("trades.panel.typeToSearch")}</p>
          ) : (
            <>
              <StatusView
                loading={loading}
                error={error}
                onRetry={() => setPage(1)}
                empty={!loading && !error && items.length === 0 ? t("trades.panel.noResults") : undefined}
              />
              {items.map((card) => {
                const reason = blockedReason(card);
                const selectedQuantity = selectedQuantities.get(card.key) ?? 0;
                return (
                  <div key={`${card.key}|${card.cardId ?? ""}`} className="list-row">
                    {card.image ? (
                      <img src={card.image} alt="" className="list-row__thumb" />
                    ) : (
                      <span className="list-row__thumb" />
                    )}
                    <div className="list-row__body">
                      <p className="list-row__title">{card.name}</p>
                      <p className="list-row__sub">
                        {card.setCode} {card.collectorNumber}
                        {card.gameName ? ` · ${card.gameName}` : ""}
                        {card.owned > 0 && ` · ${t("trades.panel.owned", { count: card.owned })}`}
                      </p>
                    </div>
                    <button
                      className={`btn ${selectedQuantity > 0 ? "btn--outline" : "btn--grad"}`}
                      style={{ padding: "8px 12px" }}
                      disabled={reason !== null}
                      title={reason ?? undefined}
                      onClick={() => onAdd(card)}
                    >
                      <PlusIcon size={16} />
                      {t("trades.panel.add")}
                    </button>
                  </div>
                );
              })}
              {totalPages > 1 && (
                <div className="card-filters__row" style={{ justifyContent: "space-between" }}>
                  <button
                    className="btn btn--outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("trades.panel.previous")}
                  </button>
                  <span className="muted">{t("trades.panel.pageOf", { page, totalPages })}</span>
                  <button
                    className="btn btn--outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("trades.panel.next")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
