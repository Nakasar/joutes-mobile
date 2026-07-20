import { useEffect, useMemo } from "react";
import { getCard } from "../api/cards";
import { useApi } from "../hooks/useApi";
import { annotateCardText } from "../lib/card-text-markdown";
import { ErrataCard } from "./ErrataCard";
import { GameMarkdown } from "./GameMarkdown";
import { BackIcon } from "./icons";
import { StatusView } from "./StatusView";

/**
 * Vue modale (feuille) d'une carte et de ses détails / erratas, affichée
 * en contexte (ex. depuis le vérificateur de deck) sans quitter l'écran.
 * Récupère la fiche complète via l'API (image, badges, texte, erratas annotés).
 */
export function CardDetailModal({
  gameSlug,
  cardId,
  fallbackName,
  fallbackImage,
  onClose,
}: {
  gameSlug: string;
  cardId: string;
  fallbackName: string;
  fallbackImage?: string;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useApi(
    () => getCard(gameSlug, cardId),
    [gameSlug, cardId],
  );

  // Ferme sur Échap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cardIdByName = useMemo(
    () =>
      new Map(
        Object.entries(data?.cardIdByName ?? {}).map(([name, id]) => [
          name.toLowerCase(),
          id,
        ]),
      ),
    [data?.cardIdByName],
  );
  const cardTextMarkdown = useMemo(
    () => (data?.text ? annotateCardText(data.text) : null),
    [data?.text],
  );

  const name = data?.name ?? fallbackName;
  const image = data?.image ?? fallbackImage;
  const erratas = data?.erratas ?? [];

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <button className="sheet__close" onClick={onClose} aria-label="Fermer">
          <BackIcon size={20} />
        </button>

        <div className="sheet__body">
          {image && (
            <div className="card-hero">
              <img src={image} alt={name} className="card-hero__image" />
            </div>
          )}
          <h2 className="card-title">{name}</h2>
          {data?.subtitle && <p className="card-subtitle">{data.subtitle}</p>}
          {data && (
            <p className="card-badges">
              {data.type && <span className="chip">{data.type}</span>}
              {typeof data.cost === "number" && (
                <span className="chip">Coût {data.cost}</span>
              )}
              {data.setCode && (
                <span className="chip">
                  {data.setCode}
                  {data.collectorNumber ? ` ${data.collectorNumber}` : ""}
                </span>
              )}
              {data.banned && <span className="chip chip--danger">Bannie</span>}
            </p>
          )}
          {cardTextMarkdown && (
            <div className="card-text-block">
              <GameMarkdown markdown={cardTextMarkdown} gameSlug={gameSlug} />
            </div>
          )}

          <StatusView loading={loading} error={error} onRetry={reload} />

          <h2 className="section-title">
            Erratas &amp; rulings
            {erratas.length > 0 && (
              <span className="section-title__count muted">
                ({erratas.length})
              </span>
            )}
          </h2>
          {!loading && erratas.length === 0 ? (
            <p className="muted">Aucun errata pour cette carte.</p>
          ) : (
            erratas.map((errata) => (
              <ErrataCard
                key={errata.id}
                errata={errata}
                gameSlug={gameSlug}
                cardIdByName={cardIdByName}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
