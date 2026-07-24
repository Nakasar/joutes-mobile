import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPolicy } from "../api/policies";
import type { Policy } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { ExternalLinkIcon } from "../components/icons";
import { GameMarkdown } from "../components/GameMarkdown";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Titre/contenu dans la langue de l'app si une traduction existe, sinon l'original. */
function policyText(policy: Policy, lang: string): { title: string; content: string } {
  const match = policy.translations?.find((tr) => tr.lang === lang);
  return match
    ? { title: match.title, content: match.content }
    : { title: policy.title, content: policy.content };
}

/** Détail d'une politique : titre, contenu markdown, source et date de mise à jour. */
export function PolicyDetailScreen() {
  const { t, i18n } = useTranslation();
  const { gameSlug = "", policyId = "" } = useParams();
  const lang = i18n.resolvedLanguage ?? i18n.language;

  const { data: policy, loading, error, reload } = useApi(
    () => getPolicy(gameSlug, policyId),
    [gameSlug, policyId],
  );

  const { title, content } = useMemo(
    () => (policy ? policyText(policy, lang) : { title: "", content: "" }),
    [policy, lang],
  );

  return (
    <div className="screen">
      <BackHeader title={policy ? title : t("policies.detailFallbackTitle")} />

      <StatusView loading={loading} error={error} onRetry={reload} />

      {policy && (
        <div className={`errata${policy.deprecatedAt ? " errata--deprecated" : ""}`}>
          <p className="errata__header">
            {policy.deprecatedAt && (
              <span className="chip chip--danger">{t("errata.deprecated")}</span>
            )}
            {policy.contentUpdatedAt && (
              <span className="errata__date">{formatDate(policy.contentUpdatedAt)}</span>
            )}
          </p>
          <div className="errata__details">
            <GameMarkdown markdown={content} gameSlug={gameSlug} />
          </div>
          {policy.source && (
            <p className="errata__footer">
              {isUrl(policy.source) ? (
                <a
                  className="errata__source"
                  href={policy.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("errata.source")}
                  <ExternalLinkIcon />
                </a>
              ) : (
                <span>{t("errata.sourceLabel", { source: policy.source })}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
