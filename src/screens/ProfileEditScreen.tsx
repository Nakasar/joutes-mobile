import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchPlaces } from "../api/geo";
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  type MyProfile,
  type MyProfilePatch,
  type NotificationSetting,
} from "../api/profile";
import type { Place } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { PinIcon, SearchIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, tintStyle } from "../lib/game-visuals";
import { useAuth } from "../store/auth";

/**
 * « Mon profil » : ce que `/account` règle sur le site en pseudo, avatar,
 * localité et notifications. La vitrine, la préférence de prix, les
 * intégrations et l'abonnement restent au site, et l'écran le dit.
 *
 * Chaque bloc s'enregistre seul : changer de ville n'envoie pas le pseudo.
 */
export function ProfileEditScreen() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const loaded = useApi(() => getMyProfile(), []);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  useEffect(() => {
    if (loaded.data) setProfile(loaded.data);
  }, [loaded.data]);

  /** Enregistre un bloc ; rend le message d'erreur, ou null. */
  async function save(patch: MyProfilePatch, refreshSession = false): Promise<string | null> {
    try {
      const next = await updateMyProfile(patch);
      setProfile(next);
      if (refreshSession) await refresh();
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : t("common.error");
    }
  }

  return (
    <div className="screen">
      <BackHeader title={t("profileEdit.title")} />
      <StatusView loading={loaded.loading && !profile} error={loaded.error} onRetry={loaded.reload} />
      {profile && (
        <>
          <IdentityCard profile={profile} onSave={save} />
          <LocationCard profile={profile} onSave={save} />
          <NotificationsCard settings={profile.notifications} onSave={save} />
          <p className="muted profile-edit__more">{t("profileEdit.moreOnWeb")}</p>
        </>
      )}
    </div>
  );
}

type Save = (patch: MyProfilePatch, refreshSession?: boolean) => Promise<string | null>;

function IdentityCard({ profile, onSave }: { profile: MyProfile; onSave: Save }) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.displayName ?? "");
  const [saving, setSaving] = useState<"name" | "avatar" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    setSaving("name");
    setMessage(null);
    const error = await onSave({ displayName: name.trim() }, true);
    setSaving(null);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: t("profileEdit.saved") });
  }

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setSaving("avatar");
    setMessage(null);
    try {
      const url = await uploadAvatar(file);
      const error = await onSave({ profileImage: url }, true);
      setMessage(error ? { ok: false, text: error } : { ok: true, text: t("profileEdit.saved") });
    } catch (err: unknown) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : t("common.error") });
    } finally {
      setSaving(null);
    }
  }

  async function removeAvatar() {
    setSaving("avatar");
    setMessage(null);
    const error = await onSave({ profileImage: "" }, true);
    setSaving(null);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: t("profileEdit.saved") });
  }

  const initial = (profile.displayName ?? "?").slice(0, 1).toUpperCase();

  return (
    <section className="card">
      <h2 className="card__title">{t("profileEdit.identity")}</h2>
      <div className="profile-edit__avatar">
        <CachedImage
          src={profile.avatar}
          alt=""
          className="avatar avatar--lg"
          fallback={
            <span className="avatar avatar--lg" style={tintStyle(colorFor(profile.displayName ?? ""))}>
              {initial}
            </span>
          }
        />
        <div className="profile-edit__avatar-actions">
          <button
            type="button"
            className="btn btn--outline"
            disabled={saving !== null}
            onClick={() => fileRef.current?.click()}
          >
            {saving === "avatar" ? t("profileEdit.uploading") : t("profileEdit.changeAvatar")}
          </button>
          {profile.profileImage && (
            <button type="button" className="btn btn--ghost" disabled={saving !== null} onClick={removeAvatar}>
              {t("profileEdit.removeAvatar")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            void pickAvatar(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <label className="field">
        <span className="field__label">{t("profileEdit.displayName")}</span>
        <div className="group-invite">
          <input value={name} maxLength={32} onChange={(e) => setName(e.currentTarget.value)} />
          <button
            type="button"
            className="btn btn--grad"
            disabled={saving !== null || !name.trim() || name.trim() === profile.displayName}
            onClick={saveName}
          >
            {saving === "name" ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </label>
      {profile.discriminator && (
        <p className="muted">
          {t("profileEdit.tag", { tag: `${profile.displayName ?? ""}#${profile.discriminator}` })}
        </p>
      )}
      {message && (
        <p className={message.ok ? "form-success" : "form-error"} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

function LocationCard({ profile, onSave }: { profile: MyProfile; onSave: Save }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      searchPlaces(q, i18n.resolvedLanguage ?? i18n.language)
        .then((places) => {
          if (id === requestId.current) setResults(places);
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, i18n.resolvedLanguage, i18n.language]);

  async function choose(place: Place | null) {
    setSaving(true);
    setError(null);
    const message = await onSave({
      location: place
        ? {
            latitude: place.latitude,
            longitude: place.longitude,
            label: place.label,
            city: place.city ?? undefined,
            postalCode: place.postalCode ?? undefined,
          }
        : null,
    });
    setSaving(false);
    if (message) setError(message);
    else {
      setQuery("");
      setResults([]);
    }
  }

  const current = profile.location;

  return (
    <section className="card">
      <h2 className="card__title">{t("profileEdit.location")}</h2>
      <p className="muted">{t("profileEdit.locationHint")}</p>
      {current && (
        <div className="profile-edit__place">
          <PinIcon size={16} />
          <span className="profile-edit__place-name">
            {current.label ??
              current.city ??
              `${current.latitude.toFixed(3)}, ${current.longitude.toFixed(3)}`}
          </span>
          <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => void choose(null)}>
            {t("profileEdit.removeLocation")}
          </button>
        </div>
      )}
      <label className="tracker-legend-search__field">
        <SearchIcon size={14} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder={t("profileEdit.locationPlaceholder")}
          aria-label={t("profileEdit.location")}
        />
      </label>
      {results.length > 0 && (
        <ul className="tracker-legend-search__list">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                className="tracker-legend-search__item"
                disabled={saving}
                onClick={() => void choose(place)}
              >
                <PinIcon size={14} />
                <span className="tracker-legend__name">{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function NotificationsCard({ settings, onSave }: { settings: NotificationSetting[]; onSave: Save }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(setting: NotificationSetting) {
    const key = `${setting.channel}.${setting.type}`;
    setBusy(key);
    setError(null);
    const message = await onSave({
      notification: { channel: setting.channel, type: setting.type, enabled: !setting.enabled },
    });
    setBusy(null);
    if (message) setError(message);
  }

  return (
    <section className="card">
      <h2 className="card__title">{t("profileEdit.notifications")}</h2>
      {settings.map((setting) => {
        const key = `${setting.channel}.${setting.type}`;
        return (
          <label key={key} className="profile-edit__switch">
            <span className="profile-edit__switch-body">
              <span className="profile-edit__switch-title">{t(`profileEdit.notif.${key}.title`)}</span>
              <span className="muted profile-edit__switch-hint">
                {setting.available
                  ? t(`profileEdit.notif.${key}.hint`)
                  : t("profileEdit.notif.discordNotLinked")}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={setting.enabled}
              disabled={!setting.available || busy !== null}
              onChange={() => void toggle(setting)}
            />
          </label>
        );
      })}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
