import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addWishlistItem,
  createWishlist,
  listMyWishlists,
} from "../api/wishlists";
import type { CardDetail, Wishlist } from "../api/types";
import { useApi } from "../hooks/useApi";
import { HeartIcon, PlusIcon } from "./icons";
import { StatusView } from "./StatusView";

interface AddToWishlistSheetProps {
  card: CardDetail;
  gameSlug: string;
  onClose: () => void;
}

function WishlistOption({
  wishlist,
  selected,
  onSelect,
}: {
  wishlist: Wishlist;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="list-row list-row--link"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={selected ? { borderColor: "var(--primary)" } : undefined}
    >
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <HeartIcon
          size={18}
          filled={selected}
          style={{ color: "var(--primary)" }}
        />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{wishlist.name}</p>
      </div>
    </div>
  );
}

export function AddToWishlistSheet({
  card,
  gameSlug,
  onClose,
}: AddToWishlistSheetProps) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(() => listMyWishlists());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(wishlistId: string) {
    setSaving(true);
    setSaveError(null);
    addWishlistItem(wishlistId, {
      cardId: card.id,
      gameSlug,
      name: card.name,
      setCode: card.setCode ?? "",
      collectorNumber: card.collectorNumber ?? "",
      image: card.image ?? "",
      type: card.type,
      quantity,
      note: note.trim() || undefined,
    })
      .then(() => setDone(true))
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
  }

  function submitNewWishlist() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError(null);
    createWishlist({ name: trimmed })
      .then((wishlist) => submit(wishlist.id))
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : t("common.error"));
        setSaving(false);
      });
  }

  const personal = data?.personal ?? [];
  const groups = data?.groups ?? [];

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
          <h2 className="form-sheet__title">{t("wishlists.addToTitle")}</h2>

          {done ? (
            <p className="status muted">{t("wishlists.addToSuccess")}</p>
          ) : (
            <>
              <StatusView loading={loading} error={error} onRetry={reload} />

              {personal.length > 0 && (
                <>
                  <p className="section-label">
                    {t("wishlists.sectionPersonal")}
                  </p>
                  {personal.map((wishlist) => (
                    <WishlistOption
                      key={wishlist.id}
                      wishlist={wishlist}
                      selected={selectedId === wishlist.id}
                      onSelect={() => {
                        setSelectedId(wishlist.id);
                        setCreatingNew(false);
                      }}
                    />
                  ))}
                </>
              )}

              {groups.map(({ group, wishlists }) => (
                <div key={group.id}>
                  <p className="section-label">
                    {t("wishlists.sectionGroup", { name: group.name })}
                  </p>
                  {wishlists.map((wishlist) => (
                    <WishlistOption
                      key={wishlist.id}
                      wishlist={wishlist}
                      selected={selectedId === wishlist.id}
                      onSelect={() => {
                        setSelectedId(wishlist.id);
                        setCreatingNew(false);
                      }}
                    />
                  ))}
                </div>
              ))}

              {creatingNew ? (
                <label className="field">
                  <span className="field__label">
                    {t("wishlists.nameLabel")}
                  </span>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.currentTarget.value)}
                    maxLength={100}
                    autoFocus
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="btn btn--outline btn--block"
                  onClick={() => {
                    setCreatingNew(true);
                    setSelectedId(null);
                  }}
                >
                  <PlusIcon size={16} />
                  {t("wishlists.createAction")}
                </button>
              )}

              {(selectedId || creatingNew) && (
                <>
                  <div className="card-filters__row">
                    <div className="stepper">
                      <button
                        className="stepper__btn"
                        onClick={() =>
                          setQuantity((q) => Math.max(1, q - 1))
                        }
                        disabled={quantity <= 1}
                      >
                        −
                      </button>
                      <span className="stepper__value">{quantity}</span>
                      <button
                        className="stepper__btn"
                        onClick={() =>
                          setQuantity((q) => Math.min(99, q + 1))
                        }
                        disabled={quantity >= 99}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <label className="field">
                    <span className="field__label">
                      {t("wishlists.noteLabel")}
                    </span>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.currentTarget.value)}
                      maxLength={300}
                    />
                  </label>
                  {saveError && <p className="form-error">{saveError}</p>}
                  <button
                    className="btn btn--grad btn--block"
                    disabled={
                      saving || (creatingNew && newName.trim().length === 0)
                    }
                    onClick={() =>
                      creatingNew ? submitNewWishlist() : submit(selectedId!)
                    }
                  >
                    {saving ? t("common.saving") : t("wishlists.addToSubmit")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
