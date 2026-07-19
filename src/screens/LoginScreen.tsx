import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

/**
 * Connexion par code OTP e-mail (Better Auth) :
 * 1. l'utilisateur saisit son e-mail, un code lui est envoyé ;
 * 2. il saisit le code, le serveur pose le cookie de session.
 */
export function LoginScreen() {
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
      setError(
        err instanceof Error ? err.message : "Impossible d'envoyer le code.",
      );
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
      setError(err instanceof Error ? err.message : "Code invalide.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen screen--centered">
      <div className="login-card">
        <h1 className="login-card__title">Joutes</h1>
        <p className="login-card__subtitle">
          {step === "email"
            ? "Connectez-vous avec votre compte joutes.app"
            : `Un code a été envoyé à ${email}`}
        </p>
        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="login-card__form">
            <label className="field">
              <span className="field__label">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? "Envoi…" : "Recevoir un code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="login-card__form">
            <label className="field">
              <span className="field__label">Code reçu par e-mail</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.currentTarget.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              Changer d'adresse e-mail
            </button>
          </form>
        )}
        <button
          type="button"
          className="button-ghost"
          onClick={() => navigate(-1)}
        >
          Retour
        </button>
      </div>
    </div>
  );
}
