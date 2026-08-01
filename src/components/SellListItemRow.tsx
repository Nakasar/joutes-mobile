import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  removeSellListItem,
  updateSellListItem,
} from "../api/sell-lists";
import type { SellListItem } from "../api/types";
import { TrashIcon } from "./icons";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CNY"];

function formatPrice(item: SellListItem): string | null {
  if (typeof item.price !== "number") return null;
  return `${item.price} ${item.currency ?? ""}`.trim();
}

function EditSellListItemSheet({
  item,
  onClose,
  onChanged,
}: {
  item: SellListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [currency, setCurrency] = useState(item.currency ?? "EUR");
  const [note, setNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmedPrice = price.trim();
    const parsedPrice = trimmedPrice ? Number(trimmedPrice) : null;
    if (parsedPrice !== null && !Number.isFinite(parsedPrice)) {
      setError(t("sellLists.invalidPrice"));
      return;
    }
    setSaving(true);
    setError(null);
    updateSellListItem(item.sellListId, item.id, {
      price: parsedPrice,
      currency: parsedPrice !== null ? currency : undefined,
      note: note.trim(),
    })
      .then(() => {
        onChanged();
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  function remove() {
    setSaving(true);
    setError(null);
    removeSellListItem(item.sellListId, item.id)
      .then(() => {
        onChanged();
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
        setSaving(false);
      });
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
          <h2 className="form-sheet__title">{item.name}</h2>
          <div className="card-filters__row">
            <label className="field" style={{ flex: 1 }}>
              <span className="field__label">
                {t("sellLists.priceLabel")}
              </span>
              <input
                type="number"
                min={0}
                max={1000000}
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.currentTarget.value)}
                placeholder={t("sellLists.noPricePlaceholder")}
              />
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.currentTarget.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            <span className="field__label">{t("sellLists.noteLabel")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              maxLength={300}
              rows={3}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn--grad btn--block"
            onClick={save}
            disabled={saving}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button
            className="btn btn--danger btn--block"
            onClick={remove}
            disabled={saving}
          >
            {t("sellLists.unlistAction")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SellListItemRow({
  item,
  canEdit,
  onChanged,
}: {
  item: SellListItem;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const price = formatPrice(item);

  function openEdit() {
    if (canEdit) setEditing(true);
  }

  function quickRemove(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (removing) return;
    setRemoving(true);
    setRemoveError(null);
    removeSellListItem(item.sellListId, item.id)
      .then(onChanged)
      .catch((err: unknown) => {
        setRemoveError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setRemoving(false));
  }

  return (
    <>
      <div
        className={`list-row${canEdit ? " list-row--link" : ""}`}
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={openEdit}
        onKeyDown={
          canEdit
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEdit();
                }
              }
            : undefined
        }
      >
        {item.image ? (
          <span className={`thumb-frame${item.foil ? " foil-shine" : ""}`}>
            <img src={item.image} alt="" className="list-row__thumb" />
          </span>
        ) : (
          <span className="list-row__thumb" />
        )}
        <div className="list-row__body">
          <p className="list-row__title">{item.name}</p>
          <p className="list-row__sub">
            {item.setCode} {item.collectorNumber}
          </p>
          <div className="copy-badges">
            {item.foil && (
              <span className="chip chip--accent">{t("printings.foil")}</span>
            )}
            {item.printingName && (
              <span className="chip">{item.printingName}</span>
            )}
            {item.condition && <span className="chip">{item.condition}</span>}
            {item.language && <span className="chip">{item.language}</span>}
          </div>
        </div>
        <div className="list-row__actions">
          {price ? (
            <span className="price-tag">{price}</span>
          ) : (
            <span className="muted">{t("sellLists.noPrice")}</span>
          )}
          {canEdit && (
            <button
              className="remove-btn"
              onClick={quickRemove}
              disabled={removing}
              aria-label={t("sellLists.unlistAction")}
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>
      </div>
      {removeError && <p className="form-error">{removeError}</p>}
      {editing && (
        <EditSellListItemSheet
          item={item}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
