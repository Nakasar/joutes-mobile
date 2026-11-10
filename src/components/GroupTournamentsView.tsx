import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGroupTournaments } from "../api/play-group-game";
import type { GroupTournamentsResponse, TournamentResult } from "../api/types";
import { currentLocale } from "../i18n";
import { isTopCut, placementLabel, recordLabel, shortLegend } from "../lib/group-game";
import { TrophyIcon } from "./icons";
import { StatusView } from "./StatusView";

type Page = Omit<GroupTournamentsResponse, "palmares" | "upcoming">;

/**
 * Les tournois des membres : leurs résultats regroupés par tournoi puis par
 * mois, le palmarès, et les inscriptions à venir. Lecture seule : déclarer un
 * résultat ou se reconnaître dans un tournoi du locator se fait sur le site,
 * où la recherche de tournoi tient à l'aise.
 */
export function GroupTournamentsView({
  groupId,
  userId,
  members,
}: {
  groupId: string;
  userId: string | null;
  members: { userId: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [member, setMember] = useState<string | undefined>(undefined);
  const [first, setFirst] = useState<GroupTournamentsResponse | null>(null);
  const [more, setMore] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMore([]);
    getGroupTournaments(groupId, { membre: member })
      .then((data) => {
        if (!cancelled) setFirst(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, member, tick, t]);

  const last = more.length > 0 ? more[more.length - 1] : first;
  async function loadMore() {
    if (!last?.nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await getGroupTournaments(groupId, { membre: member, avant: last.nextBefore });
      setMore((previous) => [...previous, page]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoadingMore(false);
    }
  }

  const nameOf = (id: string) =>
    id === userId ? t("social.groupGame.you") : (members.find((entry) => entry.userId === id)?.name ?? "");
  const locale = currentLocale();
  const monthLabel = (month: string) =>
    new Date(`${month}-01T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const dayLabel = (date: string) => new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const months = [first, ...more].flatMap((page) => page?.months ?? []);
  const withResults = members.filter((entry) => (first?.palmares ?? []).some((row) => row.userId === entry.userId));

  return (
    <>
      {withResults.length > 1 && (
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button
            className={`chip-filter${member === undefined ? " chip-filter--active" : ""}`}
            onClick={() => setMember(undefined)}
          >
            {t("social.groupDecks.allMembers")}
          </button>
          {withResults.map((entry) => (
            <button
              key={entry.userId}
              className={`chip-filter${member === entry.userId ? " chip-filter--active" : ""}`}
              onClick={() => setMember(entry.userId)}
            >
              {nameOf(entry.userId)}
            </button>
          ))}
        </div>
      )}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setTick((value) => value + 1)}
        empty={first && first.participations === 0 ? t("social.groupTournaments.empty") : undefined}
      />

      {first && first.participations > 0 && (
        <>
          <p className="muted" style={{ marginBottom: 12 }}>
            {t("social.groupTournaments.summary", {
              count: first.participations,
              tournaments: t("social.groupTournaments.tournaments", { count: first.tournaments }),
            })}
          </p>

          {first.upcoming.length > 0 && (
            <section className="card">
              <p className="section-label" style={{ marginTop: 0 }}>
                {t("social.groupTournaments.upcoming")}
              </p>
              {first.upcoming.slice(0, 3).map((entry) => (
                <Link key={entry.tournamentId} to={`/tournaments/${entry.tournamentId}`} className="group-upcoming">
                  <span className="group-upcoming__date">{dayLabel(entry.date)}</span>
                  <span className="group-upcoming__body">
                    <span className="group-upcoming__name">{entry.name}</span>
                    <span className="muted">{entry.userIds.map(nameOf).filter(Boolean).join(", ")}</span>
                  </span>
                </Link>
              ))}
            </section>
          )}

          {first.palmares.length > 0 && !member && (
            <section className="card">
              <p className="section-label" style={{ marginTop: 0 }}>
                {t("social.groupTournaments.palmares")}
              </p>
              {first.palmares.slice(0, 5).map((row) => (
                <div key={row.userId} className="group-palmares">
                  <span className="group-palmares__name">{nameOf(row.userId)}</span>
                  <span className="muted">
                    {[
                      row.wins > 0 ? t("social.groupTournaments.wins", { count: row.wins }) : undefined,
                      t("social.groupTournaments.topEights", { count: row.topEights }),
                      t("social.groupTournaments.tournaments", { count: row.tournaments }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </section>
          )}

          {months.map(({ month, tournaments }) => (
            <div key={month}>
              <p className="section-label">{monthLabel(month)}</p>
              {tournaments.map((tournament) => (
                <section key={tournament.key} className="card group-tournament">
                  <div className="group-tournament__head">
                    <span className="group-tournament__date">{dayLabel(tournament.date)}</span>
                    <div className="group-tournament__body">
                      <p className="group-tournament__name">{tournament.name}</p>
                      <p className="muted">
                        {[
                          tournament.place,
                          tournament.playerCount
                            ? t("social.groupTournaments.players", { count: tournament.playerCount })
                            : undefined,
                          t(`social.groupTournaments.source.${tournament.source}`),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  {[...tournament.results]
                    .sort((a, b) => (a.placement ?? 9999) - (b.placement ?? 9999))
                    .map((result) => (
                      <ResultLine key={result.id} result={result} name={nameOf(result.userId)} />
                    ))}
                </section>
              ))}
            </div>
          ))}

          {last?.nextBefore && (
            <button className="btn btn--outline btn--block" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? t("common.loading") : t("social.groupTournaments.more")}
            </button>
          )}
          <p className="status muted">{t("social.groupTournaments.declareOnWeb")}</p>
        </>
      )}
    </>
  );
}

function ResultLine({ result, name }: { result: TournamentResult; name: string }) {
  const { t } = useTranslation();
  // Le top annoncé par le tournoi, sinon le top 8.
  const top = isTopCut(result.placement, result.topCut);
  const medal = result.placement !== undefined && result.placement <= 3 ? result.placement : undefined;
  return (
    <div className="group-result">
      <span className={`group-result__place${medal ? ` group-result__place--${medal}` : top ? " group-result__place--top" : ""}`}>
        {medal === 1 && <TrophyIcon size={12} />}
        {result.placement !== undefined ? placementLabel(result.placement, currentLocale()) : "—"}
      </span>
      <span className="group-result__body">
        <span className="group-result__name">{name}</span>
        <span className="muted">
          {[result.legendName ? shortLegend(result.legendName) : undefined, result.record ? recordLabel(result.record) : undefined]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {result.deckId && (
        <Link to={`/decks/${result.deckId}`} className="chip">
          {t("social.groupTournaments.deck")}
        </Link>
      )}
    </div>
  );
}
