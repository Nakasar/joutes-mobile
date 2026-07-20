import { Link } from "react-router-dom";
import { config } from "../config";
import { BackHeader } from "../components/BackHeader";
import { useAuth } from "../store/auth";

export function SettingsScreen() {
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <div className="screen">
      <BackHeader title="Réglages" />
      <section className="card">
        <h2 className="card__title">Compte</h2>
        {isAuthenticated ? (
          <>
            <p>
              {user?.displayName ?? user?.name ?? user?.username ?? "Connecté"}
              {user?.discriminator ? `#${user.discriminator}` : ""}
            </p>
            {user?.email && <p className="muted">{user.email}</p>}
            <button
              className="btn btn--danger"
              style={{ marginTop: 12 }}
              onClick={() => void signOut()}
            >
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Vous n'êtes pas connecté.
            </p>
            <Link to="/login" className="btn btn--grad btn--block">
              Se connecter
            </Link>
          </>
        )}
      </section>
      <section className="card">
        <h2 className="card__title">À propos</h2>
        <p>
          Client mobile de <a href={config.webUrl}>joutes.app</a>, construit
          avec Tauri&nbsp;2 et React.
        </p>
        <p className="muted">API : {config.apiBaseUrl}</p>
      </section>
    </div>
  );
}
