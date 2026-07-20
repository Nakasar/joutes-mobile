import { useParams } from "react-router-dom";
import { getCard } from "../api/cards";
import type { Errata } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { Markdown } from "../components/Markdown";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";

const errataTypeLabels: Record<string, string> = {
  errata: "Errata",
  clarification: "Clarification",
  ruling: "Ruling",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Texte de l'errata, en français si une traduction existe. */
function errataText(errata: Errata): string {
  const fr = errata.translations?.find((t) => t.lang === "fr");
  return fr?.details ?? errata.details;
}

function ErrataCard({ errata }: { errata: Errata }) {
  const deprecated = Boolean(errata.deprecatedAt);
  return (
    <div className={`card errata${deprecated ? " errata--deprecated" : ""}`}>
      <p className="errata__header">
        <span className={`chip chip--${errata.type}`}>
          {errataTypeLabels[errata.type] ?? errata.type}
        </span>
        {deprecated && <span className="chip chip--warning">Obsolète</span>}
        {errata.errataDate && (
          <span className="muted errata__date">
            {formatDate(errata.errataDate)}
          </span>
        )}
      </p>
      <div className="errata__details">
        <Markdown text={errataText(errata)} />
      </div>
      <p className="errata__footer muted">
        {errata.source && <span>Source : {errata.source}</span>}
        {errata.votes &&
          (errata.votes.positive ?? 0) + (errata.votes.negative ?? 0) > 0 && (
            <span>
              {" "}
              · 👍 {errata.votes.positive ?? 0} · 👎 {errata.votes.negative ?? 0}
            </span>
          )}
      </p>
    </div>
  );
}

export function CardDetailScreen() {
  const { gameSlug = "", cardId = "" } = useParams();
  const { data, loading, error, reload } = useApi(
    () => getCard(gameSlug, cardId),
    [gameSlug, cardId],
  );

  const erratas = data?.erratas ?? [];

  return (
    <div className="screen">
      <BackHeader title={data?.name ?? "Carte"} />
      <StatusView loading={loading} error={error} onRetry={reload} />
      {data && (
        <>
          <div className="card-detail">
            {data.image && (
              <img
                src={data.image}
                alt={data.name}
                className="card-detail__image"
              />
            )}
            <div className="card-detail__info">
              <h2>
                {data.name}
                {data.subtitle ? `, ${data.subtitle}` : ""}
              </h2>
              <p className="card-detail__badges">
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
                {data.banned && (
                  <span className="chip chip--warning">Bannie</span>
                )}
              </p>
              {data.text && <p className="card-detail__text">{data.text}</p>}
            </div>
          </div>
          <section>
            <h2 className="section-title">
              Erratas &amp; rulings
              {erratas.length > 0 && ` (${erratas.length})`}
            </h2>
            {erratas.length === 0 ? (
              <p className="muted">
                Aucun errata, clarification ou ruling pour cette carte.
              </p>
            ) : (
              erratas.map((errata) => (
                <ErrataCard key={errata.id} errata={errata} />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
