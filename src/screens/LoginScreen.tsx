import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackIcon } from "../components/icons";
import { useAuth } from "../store/auth";

/**
 * Connexion par code OTP e-mail (Better Auth) :
 * 1. l'utilisateur saisit son e-mail, un code lui est envoyé ;
 * 2. il saisit le code, le serveur pose le cookie de session.
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const { sendOtp, signInWithOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendOtp(email);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.errorSendCode"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithOtp(email, otp);
      navigate("/collection", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.errorInvalidCode"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <button
        className="floating-back"
        onClick={() => navigate(-1)}
        aria-label={t("common.back")}
      >
        <BackIcon size={20} />
      </button>
      <div className="login-card">
        <img src="/joutes-logo.png" alt="" className="login-card__logo" />
        <h1 className="login-card__title">Joutes</h1>
        <p className="login-card__subtitle">
          {step === "email"
            ? t("login.subtitleEmail")
            : t("login.subtitleOtp", { email })}
        </p>
        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="login-card__form">
            <label className="field">
              <span className="field__label">{t("login.emailLabel")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn btn--grad btn--block"
              disabled={loading}
            >
              {loading ? t("login.sending") : t("login.sendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="login-card__form">
            <label className="field">
              <span className="field__label">{t("login.otpLabel")}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="otp-input"
                value={otp}
                onChange={(e) => setOtp(e.currentTarget.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn btn--grad btn--block"
              disabled={loading}
            >
              {loading ? t("login.signingIn") : t("common.signIn")}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              {t("login.changeEmail")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
