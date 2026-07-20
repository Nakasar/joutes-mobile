import { useMemo } from "react";
import type { Errata } from "../api/types";
import { GameMarkdown } from "./GameMarkdown";
import { ExternalLinkIcon } from "./icons";
import { annotateErrataMarkdown } from "../lib/errata-markdown";

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

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Carte d'errata / clarification / ruling avec markdown annoté. Partagée entre
 *  la fiche carte et la vue modale du vérificateur de deck. */
export function ErrataCard({
  errata,
  gameSlug,
  cardIdByName,
}: {
  errata: Errata;
  gameSlug: string;
  cardIdByName: Map<string, string>;
}) {
  const deprecated = Boolean(errata.deprecatedAt);
  const markdown = useMemo(
    () => annotateErrataMarkdown(errataText(errata), cardIdByName),
    [errata, cardIdByName],
  );

  return (
    <div
      className={`errata errata--${errata.type}${deprecated ? " errata--deprecated" : ""}`}
    >
      <p className="errata__header">
        <span className={`errata__type errata__type--${errata.type}`}>
          {errataTypeLabels[errata.type] ?? errata.type}
        </span>
        {deprecated && <span className="chip chip--danger">Obsolète</span>}
        {errata.errataDate && (
          <span className="errata__date">{formatDate(errata.errataDate)}</span>
        )}
      </p>
      <div className="errata__details">
        <GameMarkdown markdown={markdown} gameSlug={gameSlug} />
      </div>
      <p className="errata__footer">
        {errata.source &&
          (isUrl(errata.source) ? (
            <a
              className="errata__source"
              href={errata.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
              <ExternalLinkIcon />
            </a>
          ) : (
            <span>Source : {errata.source}</span>
          ))}
        {errata.votes &&
          (errata.votes.positive ?? 0) + (errata.votes.negative ?? 0) > 0 && (
            <span>
              👍 {errata.votes.positive ?? 0} · 👎 {errata.votes.negative ?? 0}
            </span>
          )}
      </p>
    </div>
  );
}
