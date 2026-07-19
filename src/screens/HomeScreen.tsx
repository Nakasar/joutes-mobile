import { useAuth } from "../store/auth";

export function HomeScreen() {
  const { user } = useAuth();

  return (
    <div className="screen">
      <header className="screen__header">
        <h1>Accueil</h1>
      </header>
      <section className="card">
        <h2>
          Bienvenue{user?.username ? `, ${user.username}` : ""} !
        </h2>
        <p>
          Ce squelette est prêt à accueillir les fonctionnalités de Joutes
          (liste des joutes, inscriptions, résultats…). Les services API sont
          centralisés dans <code>src/api/</code> : ajoutez-y les endpoints de
          la documentation officielle pour construire les écrans métier.
        </p>
      </section>
    </div>
  );
}
