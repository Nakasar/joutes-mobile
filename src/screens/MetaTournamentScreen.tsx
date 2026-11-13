import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { getMetaTournament } from "../api/meta";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { ExternalLinkIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { percentFormatter, placementLabel, shortLegend } from "../lib/group-game";
import { DeckList } from "./GameMetaScreen";

/**
 * Un tournoi de la méta : ses légendes (part, top, meilleur classement), ses
 * combinaisons de domaines, son top et ses decks par classement. Calculé par
 * le site (`GET /games/{jeu}/meta/tournaments/{date}/{slug}`).
 */
export function MetaTournamentScreen() {
  const { t } = useTranslation();
  const { gameSlug = "", date = "", slug = "" } = useParams();
  const tournament = useApi(() => getMetaTournament(gameSlug, date, slug), [gameSlug, date, slug]);
  const page = tournament.data;
  const locale = currentLocale();
  const pct = percentFormatter(locale);

  return (
    <div className="screen">
      <BackHeader title={page?.source ?? t("meta.tournament")} />
      <StatusView loading={tournament.loading && !page} error={tournament.error} onRetry={tournament.reload} />

      {page && (
        <>
          <p className="screen-subtitle">
            {[
              new Date(`${page.date}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: "long" }),
              t("meta.decks", { count: page.decks.length }),
              page.matches ? t("meta.players", { count: page.matches.players }) : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <section className="card">
            <p className="section-label" style={{ marginTop: 0 }}>{t("meta.legends")}</p>
            {page.legends.map((legend) => (
              <div key={legend.key} className="meta-legend">
                {legend.image ? (
                  <CachedImage src={legend.image} alt="" className="meta-legend__thumb" />
                ) : (
                  <span className="meta-legend__thumb meta-legend__thumb--empty" aria-hidden />
                )}
                <div className="meta-legend__body">
                  <div className="meta-legend__top">
                    <span className="meta-legend__name">{shortLegend(legend.name)}</span>
                    <span className="meta-num">{pct(legend.share)}</span>
                  </div>
                  <span className="meta-bar">
                    <span className="meta-bar__fill" style={{ width: `${legend.share * 100}%` }} />
                  </span>
                  <span className="muted meta-legend__detail">
                    {[
                      t("meta.decks", { count: legend.decks }),
                      legend.topCuts > 0 ? t("meta.topCuts", { count: legend.topCuts }) : undefined,
                      legend.best ? t("meta.best", { place: legend.best }) : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {page.combos.length > 0 && (
            <section className="card">
              <p className="section-label" style={{ marginTop: 0 }}>{t("meta.combos")}</p>
              {page.combos.map((combo) => (
                <div key={combo.domains.join("+")} className="meta-opponent">
                  <span className="meta-opponent__name">
                    {combo.domains.join(" + ")}
                    <span className="muted"> · {t("meta.decks", { count: combo.decks })}</span>
                  </span>
                  <span className="meta-num">{pct(combo.share)}</span>
                </div>
              ))}
            </section>
          )}

          {page.matches && page.matches.topCut.length > 0 && (
            <section className="card">
              <p className="section-label" style={{ marginTop: 0 }}>{t("meta.topCut")}</p>
              {page.matches.topCut.map((player) => (
                <div key={player.id} className="meta-opponent">
                  <span className="meta-opponent__name">
                    {player.place !== undefined ? `${placementLabel(player.place, locale)} · ` : ""}
                    {player.name}
                    {player.legend && <span className="muted"> · {shortLegend(player.legend)}</span>}
                  </span>
                  {player.record && <span className="meta-num">{player.record}</span>}
                </div>
              ))}
              {page.matches.url && (
                <a
                  href={page.matches.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--ghost btn--block"
                >
                  <ExternalLinkIcon size={16} />
                  {t("meta.openLocator")}
                </a>
              )}
            </section>
          )}

          <p className="section-label">{t("meta.sections.decks")}</p>
          <DeckList decks={page.decks} />
        </>
      )}
    </div>
  );
}
