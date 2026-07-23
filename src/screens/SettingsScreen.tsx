import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { config } from "../config";
import { BackHeader } from "../components/BackHeader";
import { OfflineSection } from "../components/OfflineSection";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type Language,
} from "../i18n";
import { userProfilePath } from "../lib/user-tag";
import { useAuth } from "../store/auth";

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const active = (i18n.resolvedLanguage ?? i18n.language) as Language;

  return (
    <section className="card">
      <h2 className="card__title">{t("settings.language")}</h2>
      <div className="lang-options">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang}
            className={`lang-option${lang === active ? " lang-option--active" : ""}`}
            onClick={() => void i18n.changeLanguage(lang)}
            aria-pressed={lang === active}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <div className="screen">
      <BackHeader title={t("settings.title")} />
      <section className="card">
        <h2 className="card__title">{t("settings.account")}</h2>
        {isAuthenticated ? (
          <>
            <p>
              {user?.displayName ??
                user?.name ??
                user?.username ??
                t("settings.connected")}
              {user?.discriminator ? `#${user.discriminator}` : ""}
            </p>
            {user?.email && <p className="muted">{user.email}</p>}
            {user && (
              <Link
                to={userProfilePath(user)}
                className="btn btn--outline btn--block"
                style={{ marginTop: 12 }}
              >
                {t("profile.viewMineAction")}
              </Link>
            )}
            <button
              className="btn btn--danger"
              style={{ marginTop: 12 }}
              onClick={() => void signOut()}
            >
              {t("common.signOut")}
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              {t("settings.notConnected")}
            </p>
            <Link to="/login" className="btn btn--grad btn--block">
              {t("common.signIn")}
            </Link>
          </>
        )}
      </section>
      <section className="card">
        <h2 className="card__title">{t("settings.socialTitle")}</h2>
        <p className="muted" style={{ marginBottom: 12 }}>{t("settings.socialText")}</p>
        <Link to="/social" className="btn btn--outline btn--block">
          {t("settings.socialAction")}
        </Link>
      </section>
      <LanguageSection />
      <OfflineSection />
      <section className="card">
        <h2 className="card__title">{t("settings.about")}</h2>
        <p>
          <Trans
            i18nKey="settings.aboutText"
            components={{ link: <a href={config.webUrl} /> }}
          />
        </p>
        <p className="muted">{t("settings.apiLabel", { url: config.apiBaseUrl })}</p>
      </section>
    </div>
  );
}
