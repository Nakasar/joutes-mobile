import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addCollectionProduct,
  getProductDetail,
  removeProductEntry,
  updateProductEntry,
} from "../api/products";
import type {
  PaintState,
  ProductCollectionItem,
  ProductDetail,
} from "../api/types";
import { currentLocale } from "../i18n";
import { PAINT_STATE_KEYS } from "../lib/products";
import {
  BoxIcon,
  CheckIcon,
  MiniatureIcon,
  PlusIcon,
  TrashIcon,
  UnlinkIcon,
} from "./icons";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CNY"];

/** Date du jour au format attendu par un `input[type=date]` (heure locale). */
function todayForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Fiche d'un produit et gestion de ses exemplaires.
 *
 * Le choix « j'ai la boîte » ou « j'ai juste cette figurine » ne pose jamais de
 * question : il se joue à l'endroit de la touche. Ajouter depuis l'en-tête
 * ajoute le produit, contenu compris (coché d'avance et chiffré) ; ajouter
 * depuis une ligne du contenu n'ajoute que cette figurine.
 */
export function ProductSheet({
  gameSlug,
  product,
  onClose,
  onChanged,
}: {
  gameSlug: string;
  product: ProductCollectionItem;
  onClose: () => void;
  /** Quantité possédée après la dernière opération, pour rafraîchir la tuile. */
  onChanged: (quantity: number) => void;
}) {
  const { t } = useTranslation();

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  /** Exemplaire dont le retrait emporterait du contenu : on demande confirmation. */
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);

  // Formulaire d'ajout
  const [paintState, setPaintState] = useState<PaintState | "">("");
  const [sealed, setSealed] = useState(false);
  const [addContents, setAddContents] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [obtainedAt, setObtainedAt] = useState(todayForInput);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      return getProductDetail(gameSlug, product.id)
        .then((data) => {
          setDetail(data);
          onChanged(data.quantity);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : t("products.loadError"));
        })
        .finally(() => setLoading(false));
    },
    // `onChanged` est recréé à chaque rendu du parent : le garder hors des
    // dépendances évite de relancer la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameSlug, product.id, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const isContainer = (detail?.contents.length ?? 0) > 0;
  const keptLines = (detail?.contents ?? []).filter(
    (line) => !excluded.includes(line.productId),
  );
  const keptCount = keptLines.reduce((sum, line) => sum + line.quantity, 0);

  const addOne = async (productId: string, withContents: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await addCollectionProduct(gameSlug, {
        productId,
        ...(withContents
          ? excluded.length > 0
            ? { contents: keptLines.map((line) => line.productId) }
            : {}
          : { addContents: false }),
        ...(paintState ? { paintState } : {}),
        ...(sealed ? { sealed: true } : {}),
        ...(obtainedAt ? { obtainedAt } : {}),
        ...(price
          ? { acquisitionPrice: Number(price), acquisitionCurrency: currency }
          : {}),
      });
      setShowAdd(false);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("products.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const patchEntry = async (
    entryId: string,
    patch: Parameters<typeof updateProductEntry>[1],
  ) => {
    setBusy(true);
    setError(null);
    try {
      await updateProductEntry(entryId, patch);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("products.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    setBusy(true);
    setError(null);
    try {
      await removeProductEntry(entryId);
      setConfirmingRemoval(null);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("products.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const kindLabel = t(`products.kinds.${detail?.kind ?? product.kind}`);
  const image = detail?.image ?? product.image;

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
          <div className="list-row">
            {image ? (
              <img src={image} alt="" className="product-thumb" />
            ) : (
              <span className="product-thumb product-thumb--empty">
                {(detail?.contents.length ?? 0) > 0 ? (
                  <BoxIcon size={20} />
                ) : (
                  <MiniatureIcon size={20} />
                )}
              </span>
            )}
            <div className="list-row__body">
              <p className="list-row__title">{detail?.name ?? product.name}</p>
              <p className="list-row__sub">
                {[detail?.setCode ?? product.setCode, kindLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {detail && (
              <span className="chip chip--accent">
                {t("products.copiesCount", { count: detail.quantity })}
              </span>
            )}
          </div>

          {loading && !detail && <p className="muted">{t("common.loading")}</p>}

          {detail && (
            <>
              <button
                type="button"
                className="btn btn--outline btn--block"
                onClick={() => setShowAdd((open) => !open)}
              >
                <PlusIcon size={16} />
                {t("products.add.trigger")}
              </button>

              {showAdd && (
                <div className="product-form">
                  <div className="field">
                    <span className="field__label">
                      {t("products.add.paintState")}
                    </span>
                    <div className="chip-set">
                      {PAINT_STATE_KEYS.map((state) => (
                        <button
                          key={state}
                          type="button"
                          className={`chip-filter${paintState === state ? " chip-filter--active" : ""}`}
                          onClick={() =>
                            setPaintState((current) =>
                              current === state ? "" : state,
                            )
                          }
                        >
                          {t(`products.paintStates.${state}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`toggle-row${sealed ? " toggle-row--active" : ""}`}
                    aria-pressed={sealed}
                    onClick={() => {
                      const next = !sealed;
                      setSealed(next);
                      // Une boîte encore scellée n'a rien livré : proposer d'en
                      // verser le contenu se contredirait. L'utilisateur peut
                      // recocher.
                      if (next) setAddContents(false);
                    }}
                  >
                    <span className="toggle-row__box">
                      {sealed && <CheckIcon size={14} />}
                    </span>
                    <span className="toggle-row__label">
                      {t("products.add.sealed")}
                    </span>
                  </button>

                  {isContainer && (
                    <div className="product-form__contents">
                      <button
                        type="button"
                        className={`toggle-row${addContents ? " toggle-row--active" : ""}`}
                        aria-pressed={addContents}
                        onClick={() => setAddContents((open) => !open)}
                      >
                        <span className="toggle-row__box">
                          {addContents && <CheckIcon size={14} />}
                        </span>
                        <span className="toggle-row__label">
                          {t("products.add.withContents", { count: keptCount })}
                        </span>
                      </button>

                      {addContents && (
                        <>
                          <p className="muted product-form__hint">
                            {t("products.add.withContentsHint")}
                          </p>
                          {detail.contents.map((line) => {
                            const kept = !excluded.includes(line.productId);
                            return (
                              <button
                                key={line.productId}
                                type="button"
                                className={`toggle-row${kept ? " toggle-row--active" : ""}`}
                                aria-pressed={kept}
                                onClick={() =>
                                  setExcluded((current) =>
                                    kept
                                      ? [...current, line.productId]
                                      : current.filter(
                                          (id) => id !== line.productId,
                                        ),
                                  )
                                }
                              >
                                <span className="toggle-row__box">
                                  {kept && <CheckIcon size={14} />}
                                </span>
                                <span className="toggle-row__label">
                                  {line.name}
                                </span>
                                <span className="toggle-row__count">
                                  ×{line.quantity}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  <label className="field">
                    <span className="field__label">
                      {t("products.add.obtainedAt")}
                    </span>
                    <input
                      type="date"
                      value={obtainedAt}
                      onChange={(e) => setObtainedAt(e.currentTarget.value)}
                    />
                  </label>

                  <div className="field">
                    <span className="field__label">
                      {t("products.add.price")}
                    </span>
                    <div className="card-filters__row">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.currentTarget.value)}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.currentTarget.value)}
                        style={{ flex: "0 0 auto" }}
                      >
                        {CURRENCIES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--grad btn--block"
                    disabled={busy}
                    onClick={() =>
                      void addOne(detail.id, isContainer && addContents)
                    }
                  >
                    {isContainer && addContents
                      ? t("products.add.submitWithContents", { count: keptCount })
                      : t("products.add.submit")}
                  </button>
                </div>
              )}

              {detail.entries.length > 0 && (
                <section className="product-section">
                  <h3 className="product-section__title">
                    {t("products.copies.title")}
                  </h3>
                  {detail.entries.map((entry) => (
                    <div key={entry.id} className="product-entry">
                      <div className="copy-badges">
                        {entry.paintState && (
                          <span className="chip">
                            {t(`products.paintStates.${entry.paintState}`)}
                          </span>
                        )}
                        {entry.sealed && (
                          <span className="chip chip--accent">
                            {t("products.copies.sealed")}
                          </span>
                        )}
                        {entry.box && (
                          <span
                            className={`chip${entry.box.complete ? " chip--accent" : ""}`}
                          >
                            {entry.box.owned}/{entry.box.total}
                          </span>
                        )}
                        {entry.obtainedAt && (
                          <span className="muted product-entry__meta">
                            {formatDate(entry.obtainedAt)}
                          </span>
                        )}
                        {entry.acquisitionPrice !== undefined && (
                          <span className="muted product-entry__meta">
                            {entry.acquisitionPrice}{" "}
                            {entry.acquisitionCurrency ?? ""}
                          </span>
                        )}
                      </div>

                      <div className="chip-set">
                        {PAINT_STATE_KEYS.map((state) => (
                          <button
                            key={state}
                            type="button"
                            className={`chip-filter${entry.paintState === state ? " chip-filter--active" : ""}`}
                            disabled={busy || entry.sealed}
                            title={
                              entry.sealed
                                ? t("products.copies.sealedLocked")
                                : undefined
                            }
                            onClick={() =>
                              void patchEntry(entry.id, { paintState: state })
                            }
                          >
                            {t(`products.paintStates.${state}`)}
                          </button>
                        ))}
                      </div>

                      <div className="product-entry__actions">
                        {entry.sealed && (
                          <button
                            type="button"
                            className="btn btn--outline"
                            disabled={busy}
                            onClick={() =>
                              void patchEntry(entry.id, { sealed: false })
                            }
                          >
                            {t("products.copies.unseal")}
                          </button>
                        )}
                        {entry.fromProductEntryId && (
                          <button
                            type="button"
                            className="btn btn--outline"
                            disabled={busy}
                            onClick={() =>
                              void patchEntry(entry.id, { detach: true })
                            }
                          >
                            <UnlinkIcon size={16} />
                            {t("products.copies.detach")}
                          </button>
                        )}
                        {confirmingRemoval === entry.id ? (
                          <button
                            type="button"
                            className="btn btn--danger"
                            disabled={busy}
                            onClick={() => void removeEntry(entry.id)}
                          >
                            {t("products.copies.removeConfirm", {
                              count: entry.attachedCopies,
                            })}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--ghost product-entry__remove"
                            disabled={busy}
                            onClick={() =>
                              // Retirer un conteneur emporte ce qu'il a
                              // apporté : on annonce le nombre avant d'agir.
                              entry.attachedCopies > 0
                                ? setConfirmingRemoval(entry.id)
                                : void removeEntry(entry.id)
                            }
                          >
                            <TrashIcon size={16} />
                            {t("products.copies.remove")}
                          </button>
                        )}
                      </div>

                      {confirmingRemoval === entry.id && (
                        <p className="muted product-form__hint">
                          {t("products.copies.removeBoxWarning", {
                            count: entry.attachedCopies,
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {isContainer && (
                <section className="product-section">
                  <h3 className="product-section__title">
                    {t("products.contents.title")}{" "}
                    <span className="muted">
                      {detail.content.owned}/{detail.content.total}
                    </span>
                  </h3>
                  {detail.contents.map((line) => (
                    <div key={line.productId} className="list-row">
                      {line.image ? (
                        <img src={line.image} alt="" className="product-thumb" />
                      ) : (
                        <span className="product-thumb product-thumb--empty">
                          <MiniatureIcon size={18} />
                        </span>
                      )}
                      <div className="list-row__body">
                        <p className="list-row__title">{line.name}</p>
                        <p className="list-row__sub">
                          {t("products.contents.required", {
                            count: line.quantity,
                          })}
                        </p>
                      </div>
                      <span
                        className={`product-owned${line.owned >= line.quantity ? " product-owned--complete" : ""}`}
                      >
                        ×{line.owned}
                      </span>
                      <button
                        type="button"
                        className="qty-stepper__btn"
                        disabled={busy}
                        aria-label={t("products.contents.addOne", {
                          name: line.name,
                        })}
                        onClick={() => void addOne(line.productId, false)}
                      >
                        <PlusIcon size={14} />
                      </button>
                    </div>
                  ))}
                </section>
              )}

              {!isContainer && detail.containers.length > 0 && (
                <section className="product-section">
                  <h3 className="product-section__title">
                    {t("products.contents.presentIn")}
                  </h3>
                  {detail.containers.map((container) => (
                    <div key={container.id} className="list-row">
                      {container.image ? (
                        <img
                          src={container.image}
                          alt=""
                          className="product-thumb"
                        />
                      ) : (
                        <span className="product-thumb product-thumb--empty">
                          <BoxIcon size={18} />
                        </span>
                      )}
                      <div className="list-row__body">
                        <p className="list-row__title">{container.name}</p>
                      </div>
                      {container.owned > 0 && (
                        <span className="product-owned product-owned--complete">
                          ×{container.owned}
                        </span>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
