import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  updatePlayGroupSettings,
  uploadPlayGroupImage,
  type PlayGroupSettingsInput,
} from "../api/play-groups";
import type { PlayGroup } from "../api/types";
import { CachedImage } from "./CachedImage";
import { ImageIcon, TrashIcon } from "./icons";

type ImageKey = "logo" | "banner";

/**
 * Réglages du groupe, pour le fondateur et les admins : identité (nom,
 * description, accroche de la vitrine), emblème et bannière, visibilité.
 * Seuls les champs modifiés partent au serveur. Les liens, le rythme et la
 * couleur d'accent restent sur le site.
 */
export function PlayGroupSettingsSheet({
  group,
  onClose,
  onSaved,
}: {
  group: PlayGroup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const theme = group.options?.theme;
  const initial = {
    name: group.name,
    description: group.description ?? "",
    tagline: theme?.tagline ?? "",
    logo: theme?.logo ?? "",
    banner: theme?.banner ?? "",
    visibility: group.visibility ?? "public",
  } as const;
  const [values, setValues] = useState<Required<PlayGroupSettingsInput>>({ ...initial });
  const [uploading, setUploading] = useState<ImageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = { logo: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) };

  const set = <K extends keyof PlayGroupSettingsInput>(key: K, value: Required<PlayGroupSettingsInput>[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const changes = (Object.keys(values) as (keyof PlayGroupSettingsInput)[]).reduce<PlayGroupSettingsInput>(
    (acc, key) => {
      const value = typeof values[key] === "string" ? values[key].trim() : values[key];
      if (value !== initial[key]) (acc as Record<string, string>)[key] = value;
      return acc;
    },
    {},
  );
  const dirty = Object.keys(changes).length > 0;

  async function pick(key: ImageKey, file: File | undefined) {
    if (!file) return;
    setUploading(key);
    setError(null);
    try {
      const url = await uploadPlayGroupImage(group.id, file);
      set(key, url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!dirty || !values.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updatePlayGroupSettings(group.id, changes);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setSaving(false);
    }
  }

  const imageField = (key: ImageKey) => (
    <div className="field">
      <span className="field__label">{t(`groupManage.fields.${key}`)}</span>
      <div className={`group-image-field group-image-field--${key}`}>
        {values[key] ? (
          <CachedImage src={values[key]} alt="" className="group-image-field__img" />
        ) : (
          <span className="group-image-field__img group-image-field__img--empty" aria-hidden>
            <ImageIcon size={20} />
          </span>
        )}
        <div className="group-image-field__actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={uploading !== null}
            onClick={() => fileInputs[key].current?.click()}
          >
            {uploading === key ? t("groupManage.uploading") : t("groupManage.chooseImage")}
          </button>
          {values[key] && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => set(key, "")}
              aria-label={t("groupManage.removeImage")}
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>
        <input
          ref={fileInputs[key]}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            void pick(key, e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("groupManage.settings.title")}</h2>

          <label className="field">
            <span className="field__label">{t("groupManage.fields.name")}</span>
            <input value={values.name} maxLength={80} onChange={(e) => set("name", e.currentTarget.value)} />
          </label>
          <label className="field">
            <span className="field__label">{t("groupManage.fields.tagline")}</span>
            <input
              value={values.tagline}
              maxLength={140}
              placeholder={t("groupManage.fields.taglinePlaceholder")}
              onChange={(e) => set("tagline", e.currentTarget.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t("groupManage.fields.description")}</span>
            <textarea
              value={values.description}
              maxLength={500}
              rows={3}
              onChange={(e) => set("description", e.currentTarget.value)}
            />
          </label>

          {imageField("logo")}
          {imageField("banner")}

          <label className="field">
            <span className="field__label">{t("groupManage.fields.visibility")}</span>
            <select
              value={values.visibility}
              onChange={(e) => set("visibility", e.currentTarget.value as "public" | "private")}
            >
              <option value="public">{t("groupManage.visibility.public")}</option>
              <option value="private">{t("groupManage.visibility.private")}</option>
            </select>
          </label>
          <p className="muted">{t(`groupManage.visibility.${values.visibility}Hint`)}</p>
          <p className="muted">{t("groupManage.settings.moreOnWeb")}</p>

          {error && <p className="form-error">{error}</p>}

          <button
            className="btn btn--grad btn--block"
            style={{ marginTop: 10 }}
            disabled={saving || uploading !== null || !dirty || !values.name.trim()}
            onClick={save}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
