import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { getCard } from "../api/cards";
import { BackHeader } from "../components/BackHeader";
import { ErrataCard } from "../components/ErrataCard";
import { GameMarkdown } from "../components/GameMarkdown";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { annotateCardText } from "../lib/card-text-markdown";

export function CardDetailScreen() {
  const { gameSlug = "", cardId = "" } = useParams();
  const { data, loading, error, reload } = useApi(
    () => getCard(gameSlug, cardId),
    [gameSlug, cardId],
  );

  const cardIdByName = useMemo(
    // `annotateErrataMarkdown` cherche par nom en minuscules : on normalise
    // les clés à la construction, au cas où l'API renverrait la casse d'origine.
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

  const erratas = data?.erratas ?? [];

  return (
    <div className="screen">
      <BackHeader title={data?.name ?? "Carte"} />
      <StatusView loading={loading} error={error} onRetry={reload} />
      {data && (
        <>
          {data.image && (
            <div className="card-hero">
              <img
                src={data.image}
                alt={data.name}
                className="card-hero__image"
              />
            </div>
          )}
          <h2 className="card-title">{data.name}</h2>
          {data.subtitle && <p className="card-subtitle">{data.subtitle}</p>}
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
          {cardTextMarkdown && (
            <div className="card-text-block">
              <GameMarkdown markdown={cardTextMarkdown} gameSlug={gameSlug} />
            </div>
          )}
          <section>
            <h2 className="section-title">
              Erratas &amp; rulings
              {erratas.length > 0 && (
                <span className="section-title__count muted">
                  ({erratas.length})
                </span>
              )}
            </h2>
            {erratas.length === 0 ? (
              <p className="muted">
                Aucun errata, clarification ou ruling pour cette carte.
              </p>
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
          </section>
        </>
      )}
    </div>
  );
}
