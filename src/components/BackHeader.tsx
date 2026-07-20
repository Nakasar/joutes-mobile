import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/** En-tête d'écran secondaire avec bouton retour et action optionnelle à droite. */
export function BackHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
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
      {action && <div className="back-header__action">{action}</div>}
    </header>
  );
}
