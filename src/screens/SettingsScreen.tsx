import { config } from "../config";
import { useAuth } from "../store/auth";

export function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1>Réglages</h1>
      </header>
      <section className="card">
        <h2>Compte</h2>
        <p>
          {user?.email ?? user?.username ?? "Utilisateur connecté"}
        </p>
        <button className="button-danger" onClick={() => void logout()}>
          Se déconnecter
        </button>
      </section>
      <section className="card">
        <h2>À propos</h2>
        <p>
          Client mobile de <a href={config.webUrl}>joutes.app</a>, construit
          avec Tauri&nbsp;2 et React.
        </p>
        <p className="muted">API : {config.apiBaseUrl}</p>
      </section>
    </div>
  );
}
