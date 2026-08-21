import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addWishlistItem,
  deleteWishlist,
  getWishlist,
  listWishlistItems,
  removeWishlistItem,
  updateWishlistItem,
} from "../api/wishlists";
import type { TradeCard, WishlistItem, WishlistVisibility } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { PlusIcon, TrashIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { WishlistCardPickerSheet } from "../components/WishlistCardPickerSheet";
import { useApi } from "../hooks/useApi";
import { CardImage } from "../components/CardImage";

function visibilityLabel(
  visibility: WishlistVisibility | undefined,
  t: (key: string) => string,
): string {
  switch (visibility) {
    case "public":
      return t("wishlists.visibilityPublic");
    case "unlisted":
      return t("wishlists.visibilityUnlisted");
    default:
      return t("wishlists.visibilityPrivate");
  }
}

function WishlistItemRow({
  item,
  canEdit,
  onChanged,
}: {
  item: WishlistItem;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(delta: number) {
    const next = item.quantity + delta;
    if (next < 1 || next > 99 || busy) return;
    setBusy(true);
    setError(null);
    updateWishlistItem(item.wishlistId, item.id, { quantity: next })
      .then(onChanged)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setBusy(false));
  }

  function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    removeWishlistItem(item.wishlistId, item.id)
      .then(onChanged)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setBusy(false));
  }

  return (
    <div>
      <div className="list-row">
        {item.image ? (
          // Le voile irisé dit d'un coup d'œil qu'on souhaite un exemplaire foil.
          <span className={`thumb-frame${item.foil ? " foil-shine" : ""}`}>
            <CardImage
              src={item.image}
              orientation={item.orientation}
              alt=""
              loading="lazy"
              className="list-row__thumb"
            />
          </span>
        ) : (
          <span className="list-row__thumb" />
        )}
        <div className="list-row__body">
          <p className="list-row__title">{item.name}</p>
          <p className="list-row__sub">
            {item.setCode} {item.collectorNumber}
            {typeof item.ownedQuantity === "number" &&
              ` · ${t("wishlists.owned", { count: item.ownedQuantity })}`}
          </p>
          {(item.foil || item.printingName) && (
            <div className="copy-badges">
              {item.foil && (
                <span className="chip chip--accent">{t("printings.foil")}</span>
              )}
              {item.printingName && (
                <span className="chip">{item.printingName}</span>
              )}
            </div>
          )}
        </div>
        <div className="list-row__actions">
          {canEdit ? (
            <>
              <div className="stepper">
                <button
                  className="stepper__btn"
                  onClick={() => changeQuantity(-1)}
                  disabled={busy || item.quantity <= 1}
                  aria-label={t("wishlists.decrease")}
                >
                  −
                </button>
                <span className="stepper__value">{item.quantity}</span>
                <button
                  className="stepper__btn"
                  onClick={() => changeQuantity(1)}
                  disabled={busy || item.quantity >= 99}
                  aria-label={t("wishlists.increase")}
                >
                  +
                </button>
              </div>
              <button
                className="remove-btn"
                onClick={remove}
                disabled={busy}
                aria-label={t("common.remove")}
              >
                <TrashIcon size={16} />
              </button>
            </>
          ) : (
            <span className="stepper__value">×{item.quantity}</span>
          )}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export function WishlistDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wishlistId = "" } = useParams();

  const detail = useApi(() => getWishlist(wishlistId), [wishlistId]);
  const items = useApi(() => listWishlistItems(wishlistId), [wishlistId]);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const wishlist = detail.data?.wishlist;
  const canEdit = detail.data?.canEdit ?? false;
  const addedCardIds = new Set((items.data?.items ?? []).map((item) => item.cardId));

  function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    deleteWishlist(wishlistId)
      .then(() => navigate(-1))
      .catch(() => setDeleting(false));
  }

  /**
   * La carte entre en un exemplaire : la quantité se règle ensuite à la ligne,
   * avec le même pas que pour les cartes déjà présentes. Le panneau reste
   * ouvert, une liste de souhaits se remplissant rarement d'une seule carte.
   */
  function handleAdd(card: TradeCard) {
    if (!card.cardId || !card.gameSlug || addingCardId) return;

    setAddingCardId(card.cardId);
    setAddError(null);
    addWishlistItem(wishlistId, {
      cardId: card.cardId,
      gameSlug: card.gameSlug,
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      image: card.image,
      type: card.type,
      quantity: 1,
    })
      .then(() => items.reload())
      .catch((err: unknown) => {
        setAddError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setAddingCardId(null));
  }

  return (
    <div className="screen">
      <BackHeader
        title={wishlist?.name ?? t("wishlists.detailFallbackTitle")}
        action={
          canEdit ? (
            <button
              className="icon-button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={t("wishlists.deleteAction")}
              title={t("wishlists.deleteAction")}
            >
              <TrashIcon size={18} />
            </button>
          ) : undefined
        }
      />
      <StatusView loading={detail.loading} error={detail.error} onRetry={detail.reload} />
      {wishlist && (
        <>
          <p className="list-meta">
            {wishlist.description && <>{wishlist.description}<br /></>}
            <span className="chip visibility-badge">
              {visibilityLabel(wishlist.visibility, t)}
            </span>
          </p>

          {canEdit && (
            <button
              className="btn btn--grad btn--block"
              onClick={() => {
                setAddError(null);
                setPicking(true);
              }}
            >
              <PlusIcon size={16} />
              {t("wishlists.picker.action")}
            </button>
          )}
          {addError && <p className="form-error">{addError}</p>}

          <StatusView
            loading={items.loading}
            error={items.error}
            onRetry={items.reload}
            empty={
              items.data && items.data.items.length === 0
                ? t("wishlists.itemsEmpty")
                : undefined
            }
          />
          {items.data?.items.map((item) => (
            <WishlistItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              onChanged={items.reload}
            />
          ))}
        </>
      )}

      {picking && (
        <WishlistCardPickerSheet
          addedKeys={addedCardIds}
          busyKey={addingCardId}
          onAdd={handleAdd}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
