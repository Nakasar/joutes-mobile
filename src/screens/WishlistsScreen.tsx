import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createWishlist, listMyWishlists } from "../api/wishlists";
import type { Wishlist, WishlistVisibility } from "../api/types";
import { ChevronIcon, HeartIcon, LockIcon, PlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../store/auth";

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

function WishlistRow({ wishlist }: { wishlist: Wishlist }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/wishlists/${wishlist.id}`}
      className="list-row list-row--link"
    >
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <HeartIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{wishlist.name}</p>
        <p className="list-row__sub">
          {t("wishlists.itemsCount", { count: wishlist.itemsCount ?? 0 })}
          {" · "}
          {visibilityLabel(wishlist.visibility, t)}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

function CreateWishlistSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (wishlist: Wishlist) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<WishlistVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    createWishlist({ name: trimmed, visibility })
      .then((wishlist) => {
        onCreated(wishlist);
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
          <label className="field">
            <span className="field__label">
              {t("wishlists.visibilityLabel")}
            </span>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.currentTarget.value as WishlistVisibility)
              }
            >
              <option value="private">
                {t("wishlists.visibilityPrivate")}
              </option>
              <option value="unlisted">
                {t("wishlists.visibilityUnlisted")}
              </option>
              <option value="public">{t("wishlists.visibilityPublic")}</option>
            </select>
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

function WishlistsContent() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(() => listMyWishlists());
  const [creating, setCreating] = useState(false);

  const personal = data?.personal ?? [];
  const groups = data?.groups ?? [];
  const isEmpty = data && personal.length === 0 && groups.length === 0;

  return (
    <>
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
        empty={isEmpty ? t("wishlists.empty") : undefined}
      />

      {personal.length > 0 && (
        <>
          <p className="section-label">{t("wishlists.sectionPersonal")}</p>
          {personal.map((wishlist) => (
            <WishlistRow key={wishlist.id} wishlist={wishlist} />
          ))}
        </>
      )}

      {groups.map(({ group, wishlists }) => (
        <div key={group.id}>
          <p className="section-label">
            {t("wishlists.sectionGroup", { name: group.name })}
          </p>
          {wishlists.map((wishlist) => (
            <WishlistRow key={wishlist.id} wishlist={wishlist} />
          ))}
        </div>
      ))}

      {creating && (
        <CreateWishlistSheet
          onClose={() => setCreating(false)}
          onCreated={reload}
        />
      )}
    </>
  );
}

export function WishlistsScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("wishlists.title")}</h1>
        </div>
      </div>
      {isAuthenticated ? (
        <WishlistsContent />
      ) : (
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("wishlists.gateText")}</p>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      )}
    </div>
  );
}
