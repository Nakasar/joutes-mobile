import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchTradeCards } from "../api/trades";
import type { TradeCard, TradeCardSearchResult } from "../api/types";
import { PlusIcon, SearchIcon } from "./icons";
import { StatusView } from "./StatusView";

const PAGE_SIZE = 20;

/**
 * Recherche d'une carte à ajouter à une liste de souhaits.
 *
 * La recherche passe par `GET /trades/cards` en portée « catalogue » : c'est la
 * seule du client mobile qui cherche **dans tous les jeux à la fois**, et elle
 * rend déjà tout ce qu'un souhait réclame (identifiant, jeu, série, numéro,
 * visuel). Demander d'abord un jeu, comme le fait le web, ajouterait une étape
 * là où l'écran d'un téléphone en supporte mal une de plus.
 *
 * Une carte qui n'a ni identifiant de catalogue ni jeu ne peut pas devenir un
 * souhait : plutôt que d'échouer à l'ajout, elle est proposée désactivée, avec
 * la raison.
 */
export function WishlistCardPickerSheet({
  addedKeys,
  busyKey,
  onAdd,
  onClose,
}: {
  /** Cartes déjà dans la liste, pour ne pas les proposer deux fois. */
  addedKeys: Set<string>;
  /** Carte en cours d'ajout : son bouton attend la réponse du serveur. */
  busyKey: string | null;
  onAdd: (card: TradeCard) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TradeCardSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  // Les réponses reviennent dans le désordre : seule la dernière recherche
  // lancée a le droit d'écrire dans les résultats.
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    searchTradeCards({ scope: "catalog", q: query || undefined, page, limit: PAGE_SIZE })
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
  }, [query, page, reloadTick, t]);

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;

  function blockedReason(card: TradeCard): string | null {
    if (!card.cardId || !card.gameSlug) return t("wishlists.picker.notInCatalog");
    if (addedKeys.has(card.cardId)) return t("wishlists.picker.alreadyAdded");
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
          <h2 className="form-sheet__title">{t("wishlists.picker.title")}</h2>

          <div className="search-field" style={{ marginBottom: 12 }}>
            <SearchIcon size={18} className="search-field__icon" />
            <input
              type="search"
              placeholder={t("wishlists.picker.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              autoFocus
            />
          </div>

          {result?.needsQuery ? (
            <p className="status muted">{t("wishlists.picker.typeToSearch")}</p>
          ) : (
            <>
              <StatusView
                loading={loading}
                error={error}
                onRetry={() => setReloadTick((tick) => tick + 1)}
                empty={
                  !loading && !error && items.length === 0
                    ? t("wishlists.picker.noResults")
                    : undefined
                }
              />
              {items.map((card) => {
                const reason = blockedReason(card);
                const busy = busyKey !== null && busyKey === card.cardId;

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
                      </p>
                    </div>
                    <button
                      className="btn btn--grad"
                      style={{ padding: "8px 12px" }}
                      disabled={reason !== null || busy}
                      title={reason ?? undefined}
                      onClick={() => onAdd(card)}
                    >
                      <PlusIcon size={16} />
                      {t("wishlists.picker.add")}
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
                    {t("wishlists.picker.previous")}
                  </button>
                  <span className="muted">
                    {t("wishlists.picker.pageOf", { page, totalPages })}
                  </span>
                  <button
                    className="btn btn--outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t("wishlists.picker.next")}
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
