import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getOwnedCopies } from "../api/collection";
import { addMySellListItem, removeSellListItem } from "../api/sell-lists";
import type { CardDetail, CollectionCardEntry } from "../api/types";
import { useApi } from "../hooks/useApi";
import { StatusView } from "./StatusView";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CNY"];

interface ListForSaleSheetProps {
  card: CardDetail;
  gameSlug: string;
  onClose: () => void;
}

function CopyRow({
  entry,
  gameSlug,
  onChanged,
}: {
  entry: CollectionCardEntry;
  gameSlug: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [listing, setListing] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submitListing() {
    setSaving(true);
    setError(null);
    const trimmedPrice = price.trim();
    addMySellListItem({
      collectionEntryId: entry.id,
      gameSlug,
      price: trimmedPrice ? Number(trimmedPrice) : undefined,
      currency: trimmedPrice ? currency : undefined,
      note: note.trim() || undefined,
    })
      .then(onChanged)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  function unlist() {
    if (!entry.forSale) return;
    setSaving(true);
    setError(null);
    removeSellListItem(entry.forSale.sellListId, entry.forSale.itemId)
      .then(onChanged)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
        setSaving(false);
      });
  }

  return (
    <div className="list-row" style={{ flexWrap: "wrap" }}>
      <div className="list-row__body">
        <div className="copy-badges">
          {entry.foil && <span className="chip chip--accent">Foil</span>}
          {entry.language && <span className="chip">{entry.language}</span>}
          {entry.condition && <span className="chip">{entry.condition}</span>}
        </div>
      </div>
      <div className="list-row__actions">
        {entry.forSale ? (
          <button
            className="btn btn--outline"
            onClick={unlist}
            disabled={saving}
          >
            {t("sellLists.unlistAction")}
          </button>
        ) : (
          <button
            className="btn btn--outline"
            onClick={() => setListing((v) => !v)}
          >
            {t("sellLists.listForSaleAction")}
          </button>
        )}
      </div>
      {listing && !entry.forSale && (
        <div
          className="card-filters__row"
          style={{ width: "100%", marginTop: 10 }}
        >
          <label className="field" style={{ flex: 1 }}>
            <span className="field__label">{t("sellLists.priceLabel")}</span>
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
      )}
      {listing && !entry.forSale && (
        <div style={{ width: "100%" }}>
          <label className="field">
            <span className="field__label">{t("sellLists.noteLabel")}</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              maxLength={300}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn--grad btn--block"
            style={{ marginTop: 10 }}
            onClick={submitListing}
            disabled={saving}
          >
            {saving ? t("common.saving") : t("sellLists.confirmListing")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ListForSaleSheet({
  card,
  gameSlug,
  onClose,
}: ListForSaleSheetProps) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(
    () => getOwnedCopies(card.id),
    [card.id],
  );

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
          <h2 className="form-sheet__title">{t("sellLists.listForSaleAction")}</h2>
          <StatusView loading={loading} error={error} onRetry={reload} />
          {data && data.cards.length === 0 && (
            <p className="status muted">{t("sellLists.notOwned")}</p>
          )}
          {data?.cards.map((entry) => (
            <CopyRow
              key={entry.id}
              entry={entry}
              gameSlug={gameSlug}
              onChanged={reload}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
