import { useNavigate } from "react-router-dom";

/** En-tête d'écran secondaire avec bouton retour. */
export function BackHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="back-header">
      <button
        className="back-header__button"
        onClick={() => navigate(-1)}
        aria-label="Retour"
      >
        ←
      </button>
      <h1 className="back-header__title">{title}</h1>
    </header>
  );
}
