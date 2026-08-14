import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getCard } from "../api/cards";
import { useApi } from "../hooks/useApi";
import { annotateCardText } from "../lib/card-text-markdown";
import { toCardIdByName } from "../lib/errata-markdown";
import { CardPriceDetails } from "./CardPriceDetails";
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
  const { t } = useTranslation();
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

  const cardIdByName = useMemo(() => toCardIdByName(data?.cardIdByName), [data?.cardIdByName]);
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
        <button
          className="sheet__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <BackIcon size={20} />
        </button>

        <div className="sheet__body">
          {image && (
            <div className="card-hero">
              <div
                className={`card-hero__frame${data?.foil ? " foil-shine" : ""}`}
              >
                <img src={image} alt={name} className="card-hero__image" />
              </div>
            </div>
          )}
          <h2 className="card-title">{name}</h2>
          {data?.subtitle && <p className="card-subtitle">{data.subtitle}</p>}
          {data && (
            <p className="card-badges">
              {data.foil && (
                <span className="chip chip--accent">{t("printings.foil")}</span>
              )}
              {data.type && <span className="chip">{data.type}</span>}
              {typeof data.cost === "number" && (
                <span className="chip">{t("card.cost", { cost: data.cost })}</span>
              )}
              {data.setCode && (
                <span className="chip">
                  {data.setCode}
                  {data.collectorNumber ? ` ${data.collectorNumber}` : ""}
                </span>
              )}
              {data.banned && (
                <span className="chip chip--danger">{t("card.banned")}</span>
              )}
            </p>
          )}
          {/* Le prix n'apparaît qu'une fois la fiche chargée : la carte
              d'origine (vérificateur de deck, scanner) n'en porte pas. */}
          {data && <CardPriceDetails price={data.marketPrice} gameSlug={gameSlug} />}
          {cardTextMarkdown && (
            <div className="card-text-block">
              <GameMarkdown markdown={cardTextMarkdown} gameSlug={gameSlug} />
            </div>
          )}

          <StatusView loading={loading} error={error} onRetry={reload} />

          <h2 className="section-title">
            {t("card.errataSection")}
            {erratas.length > 0 && (
              <span className="section-title__count muted">
                ({erratas.length})
              </span>
            )}
          </h2>
          {!loading && erratas.length === 0 ? (
            <p className="muted">{t("card.noErrataModal")}</p>
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
