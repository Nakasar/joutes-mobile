import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DeckExtras } from "../api/types";
import { addGroupDecks } from "../api/play-group-game";
import { listPlayGroups } from "../api/play-groups";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { placementLabel } from "../lib/group-game";
import { ExternalLinkIcon, TrophyIcon, UsersIcon } from "./icons";

/**
 * Résultats en tournoi liés au deck, comme sur la fiche du site, du plus
 * récent au plus ancien. L'écran les lit une fois (`GET /decks/{id}/extras`),
 * avec le lien CardNexus.
 */
export function DeckResultsCard({ extras }: { extras: DeckExtras | null }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const results = extras?.results ?? [];
  if (results.length === 0) return null;

  return (
    <section className="card">
      <h3 className="section-label">
        <TrophyIcon size={14} /> {t("decks.results.title")}
      </h3>
      <ul className="result-list">
        {results.map((result) => {
          const detail = [
            new Date(result.date).toLocaleDateString(locale, { dateStyle: "medium" }),
            result.placement
              ? result.playerCount
                ? t("decks.results.placementOf", {
                    place: placementLabel(result.placement, locale),
                    count: result.playerCount,
                  })
                : placementLabel(result.placement, locale)
              : undefined,
            result.record,
            result.deckVersion ? t("decks.results.version", { version: result.deckVersion }) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");
          const portal = result.tournamentHref?.match(/^\/tournaments\/([^/]+)\/player$/)?.[1];
          const body = (
            <>
              <span className="result-list__label">
                {result.name}
                <span className="muted deck-result__detail">{detail}</span>
              </span>
              {result.visibility === "private" && (
                <span className="chip">{t("decks.results.private")}</span>
              )}
            </>
          );
          return (
            <li key={result.id} className="result-list__item">
              {portal ? (
                <Link to={`/tournaments/${portal}`} className="deck-result__link">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** « Acheter le deck sur CardNexus », par le lien affilié que calcule le site. */
export function DeckCardnexusButton({ extras }: { extras: DeckExtras | null }) {
  const { t } = useTranslation();
  const order = extras?.cardnexusOrder;
  if (!order?.url) return null;
  return (
    <>
      <a
        href={order.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="btn btn--outline btn--block"
      >
        <ExternalLinkIcon size={16} />
        {t("decks.cardnexus.action")}
      </a>
      {order.matched < order.total && (
        <p className="muted deck-cardnexus__hint">
          {t("decks.cardnexus.partial", { matched: order.matched, total: order.total })}
        </p>
      )}
    </>
  );
}

/**
 * Partager le deck dans la bibliothèque d'un de mes groupes. Un deck privé
 * partagé devient lisible par les membres du groupe, et le serveur le dit en
 * cas de refus.
 */
export function ShareDeckToGroupSheet({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const groups = useApi(() => listPlayGroups(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function share(groupId: string) {
    setBusy(groupId);
    setError(null);
    try {
      const outcome = await addGroupDecks(groupId, [deckId]);
      if ((outcome.refused ?? []).length > 0) {
        setError(t("decks.shareGroup.refused"));
      } else {
        setDone((prev) => new Set(prev).add(groupId));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">{t("decks.shareGroup.title")}</h2>
          <p className="muted">{t("decks.shareGroup.hint")}</p>
          {groups.loading && <p className="muted">{t("common.loading")}</p>}
          {groups.data && groups.data.length === 0 && (
            <p className="muted">{t("decks.shareGroup.noGroups")}</p>
          )}
          {groups.data?.map((group) => (
            <div key={group.id} className="group-invitations__row">
              <span className="group-invitations__name">
                <UsersIcon size={14} /> {group.name}
              </span>
              {done.has(group.id) ? (
                <span className="chip chip--accent">{t("decks.shareGroup.shared")}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={busy !== null}
                  onClick={() => void share(group.id)}
                >
                  {busy === group.id ? t("common.saving") : t("decks.shareGroup.action")}
                </button>
              )}
            </div>
          ))}
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--grad btn--block" style={{ marginTop: 12 }} onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
