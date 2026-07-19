import { Link } from "react-router-dom";
import { config } from "../config";
import { useAuth } from "../store/auth";

export function SettingsScreen() {
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1>Réglages</h1>
      </header>
      <section className="card">
        <h2>Compte</h2>
        {isAuthenticated ? (
          <>
            <p>
              {user?.displayName ?? user?.name ?? user?.username ?? "Connecté"}
              {user?.discriminator ? `#${user.discriminator}` : ""}
            </p>
            {user?.email && <p className="muted">{user.email}</p>}
            <button className="button-danger" onClick={() => void signOut()}>
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p className="muted">Vous n'êtes pas connecté.</p>
            <Link to="/login" className="button-primary button-link">
              Se connecter
            </Link>
          </>
        )}
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
