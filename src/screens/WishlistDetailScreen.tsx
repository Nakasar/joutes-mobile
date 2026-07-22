import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteWishlist,
  getWishlist,
  listWishlistItems,
  removeWishlistItem,
  updateWishlistItem,
} from "../api/wishlists";
import type { WishlistItem, WishlistVisibility } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { TrashIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

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

  function changeQuantity(delta: number) {
    const next = item.quantity + delta;
    if (next < 1 || next > 99 || busy) return;
    setBusy(true);
    updateWishlistItem(item.wishlistId, item.id, { quantity: next })
      .then(onChanged)
      .finally(() => setBusy(false));
  }

  function remove() {
    if (busy) return;
    setBusy(true);
    removeWishlistItem(item.wishlistId, item.id)
      .then(onChanged)
      .finally(() => setBusy(false));
  }

  return (
    <div className="list-row">
      {item.image ? (
        <img src={item.image} alt="" className="list-row__thumb" />
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
  );
}

export function WishlistDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wishlistId = "" } = useParams();

  const detail = useApi(() => getWishlist(wishlistId), [wishlistId]);
  const items = useApi(() => listWishlistItems(wishlistId), [wishlistId]);
  const [deleting, setDeleting] = useState(false);

  const wishlist = detail.data?.wishlist;
  const canEdit = detail.data?.canEdit ?? false;

  function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    deleteWishlist(wishlistId)
      .then(() => navigate(-1))
      .catch(() => setDeleting(false));
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
    </div>
  );
}
