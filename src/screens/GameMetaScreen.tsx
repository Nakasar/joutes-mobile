import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { getGameMeta, type GameMetaParams, type GameMetaResponse, type MetaAppDeck } from "../api/meta";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { CaretIcon, ChevronIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { Tabs } from "../components/Tabs";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { domainColor, percentFormatter, shortLegend } from "../lib/group-game";

type Section = "overview" | "cards" | "tournaments" | "decks" | "winrates";

/**
 * La méta d'un jeu, en lecture : ce que jouent les decks de tournoi sur la
 * période, les cartes les plus jouées, les tournois, les derniers decks et
 * les winrates de l'extension en cours.
 *
 * Tout est calculé par le site (`GET /games/{jeu}/meta`), comme la page
 * `/games/{jeu}/meta` : l'écran ne fait que le mettre en page.
 */
export function GameMetaScreen() {
  const { t } = useTranslation();
  const { gameSlug = "" } = useParams();
  const [params, setParams] = useState<GameMetaParams>({});
  const [section, setSection] = useState<Section>("overview");
  const meta = useApi(
    () => getGameMeta(gameSlug, params),
    [gameSlug, params.period, params.legend, params.domain],
  );
  const page = meta.data;
  const pct = percentFormatter(currentLocale());
  const change = (patch: GameMetaParams) => setParams((previous) => ({ ...previous, ...patch }));

  return (
    <div className="screen">
      <BackHeader title={page ? t("meta.titleFor", { game: page.game.name }) : t("meta.title")} />

      <StatusView
        loading={meta.loading && !page}
        error={meta.error}
        onRetry={meta.reload}
        empty={page && page.totalDecks === 0 ? t("meta.empty") : undefined}
      />

      {page && page.totalDecks > 0 && (
        <>
          <p className="screen-subtitle">
            {t("meta.subtitle", { count: page.overview.decks, sources: page.overview.sources })}
            {page.latestDate ? ` · ${t("meta.latest", { date: formatDay(page.latestDate) })}` : ""}
          </p>

          <Filters page={page} params={params} onChange={change} />

          <Tabs<Section>
            items={[
              { key: "overview", label: t("meta.sections.overview") },
              { key: "cards", label: t("meta.sections.cards") },
              { key: "tournaments", label: t("meta.sections.tournaments") },
              { key: "decks", label: t("meta.sections.decks") },
              ...(page.winrates ? [{ key: "winrates" as const, label: t("meta.sections.winrates") }] : []),
            ]}
            current={section}
            onSelect={setSection}
          />

          {page.overview.decks === 0 ? (
            <p className="status muted">{t("meta.noDecksInFilters")}</p>
          ) : (
            <>
              {section === "overview" && <Overview page={page} pct={pct} />}
              {section === "cards" && <Cards page={page} gameSlug={gameSlug} pct={pct} />}
              {section === "decks" && <DeckList decks={page.decks} />}
            </>
          )}
          {section === "tournaments" && <Tournaments page={page} gameSlug={gameSlug} pct={pct} />}
          {section === "winrates" && page.winrates && <Winrates winrates={page.winrates} pct={pct} />}
        </>
      )}
    </div>
  );
}

function formatDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Filters({
  page,
  params,
  onChange,
}: {
  page: GameMetaResponse;
  params: GameMetaParams;
  onChange: (patch: GameMetaParams) => void;
}) {
  const { t } = useTranslation();
  const period = params.period ?? page.params.periodDays;
  const legend = page.filters.legends.find((entry) => entry.value === params.legend);

  return (
    <>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {page.periods.map((days) => (
          <button
            key={days}
            type="button"
            className={`chip-filter${period === days ? " chip-filter--active" : ""}`}
            onClick={() => onChange({ period: days })}
          >
            {days === 0 ? t("meta.periodAll") : t("meta.periodDays", { count: days })}
          </button>
        ))}
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <label className={`chip-filter chip-filter--select${legend ? " chip-filter--active" : ""}`}>
          {legend ? shortLegend(legend.label) : t("meta.allLegends")}
          <CaretIcon size={13} />
          <select
            className="chip-filter__native"
            value={params.legend ?? ""}
            aria-label={t("meta.legendFilter")}
            onChange={(e) => onChange({ legend: e.currentTarget.value || undefined })}
          >
            <option value="">{t("meta.allLegends")}</option>
            {page.filters.legends.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label} ({entry.decks})
              </option>
            ))}
          </select>
        </label>
        <label className={`chip-filter chip-filter--select${params.domain ? " chip-filter--active" : ""}`}>
          {params.domain ?? t("meta.allDomains")}
          <CaretIcon size={13} />
          <select
            className="chip-filter__native"
            value={params.domain ?? ""}
            aria-label={t("meta.domainFilter")}
            onChange={(e) => onChange({ domain: e.currentTarget.value || undefined })}
          >
            <option value="">{t("meta.allDomains")}</option>
            {page.filters.domains.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.value} ({entry.decks})
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function LegendImage({ image }: { image?: string }) {
  return image ? (
    <CachedImage src={image} alt="" className="meta-legend__thumb" />
  ) : (
    <span className="meta-legend__thumb meta-legend__thumb--empty" aria-hidden />
  );
}

function Overview({ page, pct }: { page: GameMetaResponse; pct: (value: number) => string }) {
  const { t } = useTranslation();
  const { overview } = page;
  const topLegend = overview.legends[0];

  return (
    <>
      <div className="meta-kpis">
        <Kpi label={t("meta.kpi.decks")} value={String(overview.decks)} hint={t("meta.kpi.tournaments", { count: overview.sources })} />
        <Kpi
          label={t("meta.kpi.topLegend")}
          value={topLegend ? pct(topLegend.share) : "—"}
          hint={topLegend ? shortLegend(topLegend.name) : ""}
          gold
        />
        <Kpi
          label={t("meta.kpi.topPair")}
          value={overview.topPair ? pct(overview.topPair.share) : "—"}
          hint={overview.topPair ? overview.topPair.domains.join(" + ") : ""}
        />
        <Kpi label={t("meta.kpi.cards")} value={String(overview.cardsPlayed)} hint={t("meta.kpi.cardsHint")} />
      </div>

      <section className="card">
        <p className="section-label" style={{ marginTop: 0 }}>{t("meta.legends")}</p>
        {overview.legends.slice(0, 12).map((legend) => (
          <div key={legend.key} className="meta-legend">
            <LegendImage image={legend.image} />
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
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        ))}
      </section>

      {overview.domains.length > 0 && (
        <section className="card">
          <p className="section-label" style={{ marginTop: 0 }}>{t("meta.domains")}</p>
          {overview.domains.map((domain) => (
            <div key={domain.domain} className="meta-domain">
              <span className="meta-domain__name">
                <span className="meta-dot" style={{ background: domainColor(domain.domain) }} />
                {domain.domain}
              </span>
              <span className="meta-bar">
                <span
                  className="meta-bar__fill"
                  style={{ width: `${domain.share * 100}%`, background: domainColor(domain.domain) }}
                />
              </span>
              <span className="meta-num">{pct(domain.share)}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Cards({ page, gameSlug, pct }: { page: GameMetaResponse; gameSlug: string; pct: (value: number) => string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  return (
    <section className="card">
      <p className="section-label" style={{ marginTop: 0 }}>{t("meta.cardsTitle")}</p>
      {page.cards.map((card) => (
        <Link key={card.cardId} to={`/games/${gameSlug}/cards/${card.cardId}`} className="meta-opponent meta-link">
          <span className="meta-opponent__name">
            {card.name}
            <span className="muted">
              {" · "}
              {t("meta.averageCopies", {
                copies: card.averageCopies.toLocaleString(locale, { maximumFractionDigits: 1 }),
              })}
            </span>
          </span>
          <span className="meta-num">{pct(card.share)}</span>
        </Link>
      ))}
      <p className="muted meta-footnote">{t("meta.cardsFootnote")}</p>
    </section>
  );
}

function Tournaments({
  page,
  gameSlug,
  pct,
}: {
  page: GameMetaResponse;
  gameSlug: string;
  pct: (value: number) => string;
}) {
  const { t } = useTranslation();
  if (page.tournaments.length === 0) return <p className="status muted">{t("meta.noTournaments")}</p>;
  return (
    <>
      {page.tournaments.map((tournament) => (
        <Link
          key={`${tournament.date}-${tournament.slug}`}
          to={`/games/${gameSlug}/meta/tournaments/${tournament.date}/${encodeURIComponent(tournament.slug)}`}
          className="list-row list-row--link"
        >
          <LegendImage image={tournament.winner?.image ?? tournament.topLegend?.image} />
          <div className="list-row__body">
            <p className="list-row__title">{tournament.source}</p>
            <p className="list-row__sub">
              {[
                formatDay(tournament.date),
                t("meta.decks", { count: tournament.decks }),
                tournament.winner?.legend
                  ? t("meta.winner", { legend: shortLegend(tournament.winner.legend) })
                  : tournament.topLegend
                    ? `${shortLegend(tournament.topLegend.name)} ${pct(tournament.topLegend.share)}`
                    : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      ))}
    </>
  );
}

export function DeckList({ decks }: { decks: MetaAppDeck[] }) {
  const { t } = useTranslation();
  if (decks.length === 0) return <p className="status muted">{t("meta.noDecksInFilters")}</p>;
  return (
    <>
      {decks.map((deck) => (
        <Link key={deck.id} to={`/decks/${deck.id}`} className="list-row list-row--link">
          <LegendImage image={deck.legendImage} />
          <div className="list-row__body">
            <p className="list-row__title">
              {deck.placement ? `${deck.placement} · ` : ""}
              {deck.legend ? shortLegend(deck.legend) : deck.name}
            </p>
            <p className="list-row__sub">
              {[deck.pilot, deck.source, formatDay(deck.date)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      ))}
    </>
  );
}

function rateClass(rate?: number): string {
  if (rate === undefined) return " muted";
  return rate > 0.5 ? " meta-num--up" : rate < 0.5 ? " meta-num--down" : "";
}

function Winrates({
  winrates,
  pct,
}: {
  winrates: NonNullable<GameMetaResponse["winrates"]>;
  pct: (value: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <p className="screen-subtitle">
        {winrates.period ? t("meta.winratesPeriod", { set: winrates.period.name }) : t("meta.winratesAll")}
        {" · "}
        {t("meta.matches", { count: winrates.totals.matches })}
      </p>
      <section className="card">
        <p className="section-label" style={{ marginTop: 0 }}>{t("meta.legends")}</p>
        {winrates.legends.map((row) => (
          <div key={row.legend} className="meta-opponent">
            <span className="meta-opponent__name">
              {shortLegend(row.legend)}
              <span className="muted">
                {" · "}
                {t("meta.record", { wins: row.wins, losses: row.losses, draws: row.draws })}
              </span>
            </span>
            <span className={`meta-num${rateClass(row.rate)}`}>{row.rate !== undefined ? pct(row.rate) : "—"}</span>
          </div>
        ))}
      </section>
      {winrates.domains.length > 0 && (
        <section className="card">
          <p className="section-label" style={{ marginTop: 0 }}>{t("meta.domains")}</p>
          {winrates.domains.map((row) => (
            <div key={row.domain} className="meta-opponent">
              <span className="meta-opponent__name">
                <span className="meta-dot" style={{ background: domainColor(row.domain) }} /> {row.domain}
                <span className="muted"> · {t("meta.matches", { count: row.matches })}</span>
              </span>
              <span className={`meta-num${rateClass(row.rate)}`}>{row.rate !== undefined ? pct(row.rate) : "—"}</span>
            </div>
          ))}
        </section>
      )}
      <p className="muted meta-footnote">{t("meta.winratesFootnote")}</p>
    </>
  );
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
