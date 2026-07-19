import { useState, type FormEvent } from "react";
import { useAuth } from "../store/auth";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen screen--centered">
      <div className="login-card">
        <h1 className="login-card__title">Joutes</h1>
        <p className="login-card__subtitle">
          Connectez-vous avec votre compte joutes.app
        </p>
        <form onSubmit={handleSubmit} className="login-card__form">
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
          <label className="field">
            <span className="field__label">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
