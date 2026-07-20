interface StatusViewProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Message affiché quand il n'y a ni chargement ni erreur (liste vide). */
  empty?: string;
}

/** Affichage uniforme des états chargement / erreur / vide d'un écran. */
export function StatusView({ loading, error, onRetry, empty }: StatusViewProps) {
  if (loading) {
    return <p className="status muted">Chargement…</p>;
  }
  if (error) {
    return (
      <div className="status">
        <p className="form-error">{error}</p>
        {onRetry && (
          <button
            className="btn btn--grad"
            style={{ marginTop: 12 }}
            onClick={onRetry}
          >
            Réessayer
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return <p className="status muted">{empty}</p>;
  }
  return null;
}
