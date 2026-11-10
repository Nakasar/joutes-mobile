import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getGroupMeta, type GroupMetaParams } from "../api/play-group-game";
import type { GroupMetaLegend, GroupMetaResponse } from "../api/types";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { domainColor, percentFormatter, placementLabel, pointsDelta, shortLegend } from "../lib/group-game";
import { CachedImage } from "./CachedImage";
import { StatusView } from "./StatusView";

/**
 * La méta du groupe, en version compacte : ce que jouent les membres sur la
 * période (l'extension en cours par défaut), comparé à la méta du jeu quand
 * il en a une, et contre quelles légendes le groupe gagne.
 *
 * Les calculs sont ceux du site (`GET /play-groups/{id}/meta`) : l'écran ne
 * fait que les mettre en page. Un winrate ne s'y lit qu'à partir de 10 matchs.
 */
export function GroupMetaView({
  groupId,
  userId,
  members,
}: {
  groupId: string;
  userId: string | null;
  members: { userId: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [params, setParams] = useState<GroupMetaParams>({});
  const meta = useApi(() => getGroupMeta(groupId, params), [groupId, params.jeu, params.ext, params.comparer]);
  const pct = percentFormatter(currentLocale());
  const nameOf = (id: string) =>
    id === userId ? t("social.groupGame.you") : (members.find((entry) => entry.userId === id)?.name ?? "");

  const page = meta.data;
  const change = (patch: GroupMetaParams) => setParams((previous) => ({ ...previous, ...patch }));

  return (
    <>
      <StatusView
        loading={meta.loading && !page}
        error={meta.error}
        onRetry={meta.reload}
        empty={page && !page.game ? t("social.groupMeta.empty") : undefined}
      />

      {page?.game && (
        <>
          {page.games.length > 1 && (
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {page.games.map(({ game, count }) => (
                <button
                  key={game.id}
                  className={`chip-filter${page.game?.id === game.id ? " chip-filter--active" : ""}`}
                  onClick={() => change({ jeu: game.id, ext: undefined })}
                >
                  {game.name} · {count}
                </button>
              ))}
            </div>
          )}

          <div className="chip-row" style={{ marginBottom: 8 }}>
            {page.periods
              .slice()
              .reverse()
              .map((period) => (
                <button
                  key={period.setCode}
                  className={`chip-filter${page.period?.setCode === period.setCode ? " chip-filter--active" : ""}`}
                  onClick={() => change({ ext: period.setCode })}
                >
                  {period.name}
                </button>
              ))}
            <button
              className={`chip-filter${!page.period ? " chip-filter--active" : ""}`}
              onClick={() => change({ ext: "tout" })}
            >
              {t("social.groupMeta.allPeriods")}
            </button>
          </div>

          {page.hasMeta && (
            <label className="check-row" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={params.comparer !== "0"}
                onChange={(event) => change({ comparer: event.currentTarget.checked ? undefined : "0" })}
              />
              <span className="check-row__body">
                <span className="check-row__title">{t("social.groupMeta.compare")}</span>
              </span>
            </label>
          )}

          {page.meta.totals.participations === 0 ? (
            <p className="status muted">{t("social.groupMeta.noResultsInPeriod")}</p>
          ) : (
            <MetaBody page={page} pct={pct} nameOf={nameOf} />
          )}
        </>
      )}
    </>
  );
}

function MetaBody({
  page,
  pct,
  nameOf,
}: {
  page: GroupMetaResponse;
  pct: (value: number) => string;
  nameOf: (userId: string) => string;
}) {
  const { t } = useTranslation();
  const { totals, legends, domains, members, overview } = page.meta;
  const locale = currentLocale();

  return (
    <>
      <div className="meta-kpis">
        <Kpi label={t("social.groupMeta.kpi.participations")} value={String(totals.participations)} hint={t("social.groupTournaments.tournaments", { count: totals.tournaments })} />
        <Kpi label={t("social.groupMeta.kpi.legends")} value={String(legends.length)} hint={t("social.groupMeta.kpi.members", { count: totals.members })} />
        <Kpi label={t("social.groupMeta.kpi.topEights")} value={String(totals.topEights)} hint={pct(totals.topEights / totals.participations)} gold />
        <Kpi
          label={t("social.groupMeta.kpi.winrate")}
          value={totals.rate !== undefined ? pct(totals.rate) : "—"}
          hint={totals.matches > 0 ? t("social.groupMeta.matches", { count: totals.matches }) : t("social.groupMeta.kpi.noRecord")}
        />
      </div>

      <section className="card">
        <div className="meta-head">
          <p className="section-label" style={{ margin: 0 }}>{t("social.groupMeta.legends")}</p>
          {page.compared && <span className="meta-head__marker">{t("social.groupMeta.marker")}</span>}
        </div>
        {legends.slice(0, 8).map((legend) => (
          <LegendLine key={legend.key} legend={legend} page={page} pct={pct} nameOf={nameOf} />
        ))}
      </section>

      {domains.length > 0 && (
        <section className="card">
          <p className="section-label" style={{ marginTop: 0 }}>{t("social.groupMeta.domains")}</p>
          {domains.map((domain) => (
            <div key={domain.domain} className="meta-domain">
              <span className="meta-domain__name">
                <span className="meta-dot" style={{ background: domainColor(domain.domain) }} />
                {domain.domain}
              </span>
              <span className="meta-bar">
                <span className="meta-bar__fill" style={{ width: `${domain.share * 100}%`, background: domainColor(domain.domain) }} />
                {domain.metaShare !== undefined && <span className="meta-bar__marker" style={{ left: `${domain.metaShare * 100}%` }} />}
              </span>
              <span className="meta-num">{pct(domain.share)}</span>
            </div>
          ))}
          {overview.topPair && (
            <p className="muted" style={{ marginTop: 8 }}>
              {t("social.groupMeta.topPair", { pair: overview.topPair.domains.join(" + "), share: pct(overview.topPair.share) })}
            </p>
          )}
        </section>
      )}

      <section className="card">
        <p className="section-label" style={{ marginTop: 0 }}>{t("social.groupMeta.matchups")}</p>
        {page.matchups.opponents.length === 0 ? (
          <p className="muted">{t("social.groupMeta.noMatchups")}</p>
        ) : (
          page.matchups.opponents.slice(0, 6).map((row) => (
            <div key={row.legend} className="meta-opponent">
              <LegendImage image={row.cardId ? page.cards[row.cardId]?.image : undefined} />
              <span className="meta-opponent__name">
                {shortLegend((row.cardId && page.cards[row.cardId]?.name) || row.legend)}
                <span className="muted"> · {t("social.groupMeta.matches", { count: row.matches })}</span>
              </span>
              <span className={`meta-num${rateClass(row.rate)}`}>{row.rate !== undefined ? pct(row.rate) : "—"}</span>
            </div>
          ))
        )}
        <p className="muted meta-footnote">{t("social.groupMeta.footnote")}</p>
      </section>

      <section className="card">
        <p className="section-label" style={{ marginTop: 0 }}>{t("social.groupMeta.members")}</p>
        {members.map((row) => (
          <div key={row.userId} className="meta-member">
            <span className="meta-member__name">{nameOf(row.userId)}</span>
            <span className="muted">
              {[
                t("social.groupTournaments.tournaments", { count: row.tournaments }),
                row.best !== undefined ? t("social.groupMeta.best", { place: placementLabel(row.best, locale) }) : undefined,
                row.rate !== undefined ? pct(row.rate) : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function rateClass(rate?: number): string {
  if (rate === undefined) return " muted";
  return rate > 0.5 ? " meta-num--up" : rate < 0.5 ? " meta-num--down" : "";
}

function Kpi({ label, value, hint, gold }: { label: string; value: string; hint: string; gold?: boolean }) {
  return (
    <div className="meta-kpi">
      <span className="meta-kpi__label">{label}</span>
      <span className={`meta-kpi__value${gold ? " meta-kpi__value--gold" : ""}`}>{value}</span>
      <span className="meta-kpi__hint">{hint}</span>
    </div>
  );
}

function LegendImage({ image }: { image?: string }) {
  return image ? (
    <CachedImage src={image} alt="" className="meta-legend__thumb" />
  ) : (
    <span className="meta-legend__thumb meta-legend__thumb--empty" aria-hidden />
  );
}

function LegendLine({
  legend,
  page,
  pct,
  nameOf,
}: {
  legend: GroupMetaLegend;
  page: GroupMetaResponse;
  pct: (value: number) => string;
  nameOf: (userId: string) => string;
}) {
  const { t } = useTranslation();
  const players = legend.userIds.map(nameOf).filter(Boolean).join(", ");
  return (
    <div className="meta-legend">
      <LegendImage image={legend.image ?? (legend.cardId ? page.cards[legend.cardId]?.image : undefined)} />
      <div className="meta-legend__body">
        <div className="meta-legend__top">
          <span className="meta-legend__name">{shortLegend(legend.name)}</span>
          <span className="meta-num">{pct(legend.share)}</span>
        </div>
        <span className="meta-bar">
          <span className="meta-bar__fill" style={{ width: `${legend.share * 100}%` }} />
          {legend.metaShare !== undefined && <span className="meta-bar__marker" style={{ left: `${legend.metaShare * 100}%` }} />}
        </span>
        <span className="muted meta-legend__detail">
          {[
            t("social.groupMeta.decks", { count: legend.decks }),
            players,
            legend.metaShare !== undefined
              ? t("social.groupMeta.vsMeta", { points: pointsDelta(legend.share, legend.metaShare) })
              : undefined,
            legend.rate !== undefined ? t("social.groupMeta.winrate", { rate: pct(legend.rate) }) : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </div>
  );
}
