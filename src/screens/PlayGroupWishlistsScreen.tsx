import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  createPlayGroupWishlist,
  listPlayGroupWishlists,
} from "../api/wishlists";
import type { Wishlist } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { ChevronIcon, HeartIcon, PlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

function CreateGroupWishlistSheet({
  groupId,
  onClose,
  onCreated,
}: {
  groupId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    createPlayGroupWishlist(groupId, { name: trimmed })
      .then(() => {
        onCreated();
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
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
          <h2 className="form-sheet__title">{t("wishlists.createTitle")}</h2>
          <label className="field">
            <span className="field__label">{t("wishlists.nameLabel")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              maxLength={100}
              autoFocus
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn--grad btn--block"
            onClick={submit}
            disabled={saving || name.trim().length === 0}
          >
            {saving ? t("common.saving") : t("wishlists.createSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupWishlistRow({ wishlist }: { wishlist: Wishlist }) {
  const { t } = useTranslation();
  return (
    <Link to={`/wishlists/${wishlist.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <HeartIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{wishlist.name}</p>
        <p className="list-row__sub">
          {t("wishlists.itemsCount", { count: wishlist.itemsCount ?? 0 })}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

export function PlayGroupWishlistsScreen() {
  const { t } = useTranslation();
  const { groupId = "" } = useParams();
  const { data, loading, error, reload } = useApi(
    () => listPlayGroupWishlists(groupId),
    [groupId],
  );
  const [creating, setCreating] = useState(false);

  return (
    <div className="screen">
      <BackHeader title={t("social.groupDetail.wishlistsAction")} />
      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 16 }}
        onClick={() => setCreating(true)}
      >
        <PlusIcon size={18} />
        {t("wishlists.createAction")}
      </button>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data && data.length === 0 ? t("wishlists.empty") : undefined}
      />
      {data?.map((wishlist) => (
        <GroupWishlistRow key={wishlist.id} wishlist={wishlist} />
      ))}
      {creating && (
        <CreateGroupWishlistSheet
          groupId={groupId}
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
