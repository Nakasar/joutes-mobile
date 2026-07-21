import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Errata } from "../api/types";
import { GameMarkdown } from "./GameMarkdown";
import { ExternalLinkIcon } from "./icons";
import { annotateErrataMarkdown } from "../lib/errata-markdown";
import { currentLocale } from "../i18n";

const errataTypeLabelKeys: Record<string, string> = {
  errata: "errata.typeErrata",
  clarification: "errata.typeClarification",
  ruling: "errata.typeRuling",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Texte de l'errata dans la langue de l'app si une traduction existe, sinon le
 * texte original. Les erratas ne sont pas toujours traduits dans les 4 langues.
 */
function errataText(errata: Errata, lang: string): string {
  const match = errata.translations?.find((t) => t.lang === lang);
  return match?.details ?? errata.details;
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
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const deprecated = Boolean(errata.deprecatedAt);
  const markdown = useMemo(
    () => annotateErrataMarkdown(errataText(errata, lang), cardIdByName),
    [errata, cardIdByName, lang],
  );

  return (
    <div
      className={`errata errata--${errata.type}${deprecated ? " errata--deprecated" : ""}`}
    >
      <p className="errata__header">
        <span className={`errata__type errata__type--${errata.type}`}>
          {errataTypeLabelKeys[errata.type]
            ? t(errataTypeLabelKeys[errata.type])
            : errata.type}
        </span>
        {deprecated && (
          <span className="chip chip--danger">{t("errata.deprecated")}</span>
        )}
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
              {t("errata.source")}
              <ExternalLinkIcon />
            </a>
          ) : (
            <span>{t("errata.sourceLabel", { source: errata.source })}</span>
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
