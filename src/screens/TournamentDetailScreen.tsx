import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmMatchResult,
  disputeMatchResult,
  dropSelf,
  getHistory,
  getPlayerForm,
  getStandings,
  reportMatchResult,
} from "../api/tournaments";
import type {
  TournamentDetail,
  TournamentGameResult,
  TournamentHistory,
  TournamentLiveState,
  TournamentMatch,
  TournamentMatchStatus,
  TournamentPhase,
  TournamentPlayer,
  TournamentRound,
  TournamentScenario,
  TournamentStanding,
} from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { ChevronIcon, MegaphoneIcon, ScrollIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { TournamentReportSheet } from "../components/TournamentReportSheet";
import { useApi } from "../hooks/useApi";
import { useMyTournamentPlayer } from "../hooks/useMyTournamentPlayer";
import { useTournamentLive } from "../hooks/useTournamentLive";
import { currentLocale } from "../i18n";
import { playerTag } from "../lib/tournament-player";
import { removeSyncKey } from "../lib/tournament-sync-storage";
import { formatDuration, timerIsPaused, timerRemainingSeconds } from "../lib/tournament-timer";
import {
  deadlineIsPast,
  formatDeadline,
  formatDeadlineDate,
  serverNowMs,
} from "../lib/tournament-deadline";
import { presetStats, type MatchStatDefinition } from "../lib/tournament-presets";

type Tab = "match" | "standings" | "info";

/** Une ronde replacée dans sa phase, l'historique étant lu à plat un peu partout. */
interface FlatRound {
  phase: TournamentPhase;
  round: TournamentRound;
  matches: TournamentMatch[];
}

function matchStatusChipClass(status: TournamentMatchStatus): string {
  switch (status) {
    case "completed":
      return "chip--accent";
    case "in-progress":
      return "chip--warning";
    case "disputed":
      return "chip--danger";
    default:
      return "";
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Re-rendu périodique, pour que le décompte du minuteur avance à l'écran. */
function useTick(intervalMs: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/**
 * En-tête sombre du portail : le tournoi, la ronde, le minuteur et la dernière
 * annonce. L'annonce vit ici parce que c'est la seule information qu'un joueur
 * ne doit jamais rater, quel que soit l'onglet ouvert.
 */
function PortalHeader({
  name,
  roundLabel,
  meLabel,
  deadlineAt,
  state,
  serverOffsetMs,
}: {
  name: string;
  roundLabel: string | null;
  meLabel: string | null;
  /**
   * Échéance de l'intervalle en cours (ronde asynchrone). Prend la place du
   * minuteur, qui n'a pas de sens quand la partie se joue sur plusieurs jours.
   */
  deadlineAt?: string;
  /** État public du tournoi, chargé une seule fois par l'écran. */
  state: TournamentLiveState | null;
  serverOffsetMs: number;
}) {
  const { t, i18n } = useTranslation();
  useTick(1000);

  const remaining = timerRemainingSeconds(state?.timer, serverOffsetMs);
  const paused = timerIsPaused(state?.timer);
  const expired = remaining !== null && remaining < 0;
  const low = remaining !== null && remaining >= 0 && remaining < 300;
  const announcement = state?.announcements[0];

  return (
    <div className="portal-header">
      <div className="portal-header__top">
        <div className="portal-header__titles">
          <p className="portal-header__name">{name}</p>
          {roundLabel && <p className="portal-header__meta">{roundLabel}</p>}
        </div>
        {deadlineAt ? (
          <div className="portal-header__timer">
            <p
              className={`portal-header__deadline${deadlineIsPast(deadlineAt, serverNowMs(serverOffsetMs)) ? " portal-header__clock--expired" : ""}`}
            >
              {formatDeadline(deadlineAt, i18n.language, serverNowMs(serverOffsetMs))}
            </p>
            <p className="portal-header__timer-label">{t("tournaments.deadlineLabel")}</p>
          </div>
        ) : (
          remaining !== null && (
            <div className="portal-header__timer">
              <p
                className={`portal-header__clock${expired ? " portal-header__clock--expired" : low ? " portal-header__clock--low" : ""}`}
              >
                {formatDuration(remaining)}
              </p>
              <p className="portal-header__timer-label">
                {paused ? t("tournaments.timerPaused") : t("tournaments.timerRemaining")}
              </p>
            </div>
          )
        )}
      </div>

      {announcement && (
        <div
          className={`portal-announce${announcement.level === "urgent" ? " portal-announce--urgent" : ""}`}
        >
          <MegaphoneIcon size={18} />
          <p className="portal-announce__text">{announcement.message}</p>
        </div>
      )}

      {meLabel && (
        <p className="portal-header__me">
          {t("tournaments.participatingAs")} <strong>{meLabel}</strong>
        </p>
      )}
    </div>
  );
}

/** Carte de table : ce que le joueur cherche à trois mètres du panneau. */
function MyMatchCard({
  match,
  myPlayerId,
  opponent,
  opponentStanding,
  playerName,
  deadlineAt,
  scenario,
  serverOffsetMs,
}: {
  match: TournamentMatch;
  myPlayerId: string | undefined;
  opponent: TournamentPlayer | undefined;
  opponentStanding: TournamentStanding | undefined;
  playerName: (playerId: string) => string;
  deadlineAt?: string;
  scenario?: TournamentScenario;
  /** Décalage d'horloge client/serveur, pour dater l'échéance sans dériver. */
  serverOffsetMs: number;
}) {
  const { t, i18n } = useTranslation();
  const isBye = match.players.length <= 1;
  const extensionMinutes = Math.round((match.extensionSeconds ?? 0) / 60);
  const opponentEntry = match.players.find((p) => p.playerId !== myPlayerId);

  return (
    <div className="table-card">
      {/* Sur un intervalle de ligue, il n'y a pas de table : ce qui compte est
          la date avant laquelle la partie doit être jouée. */}
      {deadlineAt ? (
        <>
          <p className="table-card__eyebrow">{t("tournaments.playBefore")}</p>
          <p className="table-card__deadline">{formatDeadlineDate(deadlineAt, i18n.language)}</p>
          <p className="table-card__record">
            {formatDeadline(deadlineAt, i18n.language, serverNowMs(serverOffsetMs))}
          </p>
        </>
      ) : (
        <>
          <p className="table-card__eyebrow">{t("tournaments.yourTable")}</p>
          <p className="table-card__number">{match.tableNumber ?? "—"}</p>
        </>
      )}

      {isBye ? (
        <p className="muted">{t("tournaments.byeAutoWin")}</p>
      ) : (
        <>
          <p className="table-card__against">{t("tournaments.against")}</p>
          <p className="table-card__opponent">
            {opponent?.displayName ??
              (opponentEntry ? playerName(opponentEntry.playerId) : t("tournaments.unknownPlayer"))}
            {opponent?.discriminator && (
              <span className="table-card__discriminator">#{opponent.discriminator}</span>
            )}
          </p>
          {opponentStanding && (
            <p className="table-card__record">
              {t("tournaments.recordLabel", {
                wins: opponentStanding.wins,
                losses: opponentStanding.losses,
                draws: opponentStanding.draws,
              })}
            </p>
          )}
        </>
      )}

      <span className={`chip status-badge ${matchStatusChipClass(match.status)}`}>
        {t(`tournaments.matchStatus.${match.status}`)}
      </span>

      {scenario && (
        <div className="table-card__scenario">
          <p className="table-card__eyebrow">{t("tournaments.scenario")}</p>
          <p className="table-card__scenario-name">{scenario.name}</p>
          {scenario.description && (
            <p className="table-card__scenario-text">{scenario.description}</p>
          )}
        </div>
      )}

      {extensionMinutes > 0 && (
        <p className="table-card__extension">
          {t("tournaments.extensionGranted", { minutes: extensionMinutes })}
        </p>
      )}
    </div>
  );
}

/** Onglet « Mon match » : où je joue, contre qui, et le geste du moment. */
function MatchTab({
  tournamentId,
  detail,
  myPlayerId,
  myMatch,
  otherMatches,
  bestOf,
  resultMode,
  stats,
  deadlineAt,
  scenario,
  serverOffsetMs,
  standings,
  playerName,
  playerById,
  syncKey,
  roundExists,
  onChanged,
}: {
  tournamentId: string;
  detail: TournamentDetail;
  myPlayerId: string | undefined;
  myMatch: TournamentMatch | undefined;
  otherMatches: TournamentMatch[];
  bestOf: number;
  resultMode: TournamentPhase["resultMode"];
  /** Statistiques secondaires relevées par la phase. Vide = aucune. */
  stats: MatchStatDefinition[];
  /** Échéance de l'intervalle en cours (ronde asynchrone). */
  deadlineAt?: string;
  scenario?: TournamentScenario;
  serverOffsetMs: number;
  standings: TournamentStanding[];
  playerName: (playerId: string) => string;
  playerById: Map<string, TournamentPlayer>;
  syncKey: string | undefined;
  roundExists: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myStatus = myPlayerId ? playerById.get(myPlayerId)?.status : undefined;
  const opponentEntry = myMatch?.players.find((p) => p.playerId !== myPlayerId);
  const opponent = opponentEntry ? playerById.get(opponentEntry.playerId) : undefined;
  const opponentName = opponentEntry
    ? playerName(opponentEntry.playerId)
    : t("tournaments.byeShort");
  const opponentStanding = opponentEntry
    ? standings.find((s) => s.playerId === opponentEntry.playerId)
    : undefined;

  const myRankIndex = standings.findIndex((s) => s.playerId === myPlayerId);
  const myStanding = myRankIndex >= 0 ? standings[myRankIndex] : undefined;

  const isBye = (myMatch?.players.length ?? 0) <= 1;
  const iAmInMatch = !!myMatch?.players.some((p) => p.playerId === myPlayerId);
  const iReported = myMatch?.reportedBy === myPlayerId;
  const canSelfReport =
    !!myMatch &&
    !isBye &&
    iAmInMatch &&
    detail.settings.allowSelfReporting &&
    myStatus !== "dropped";
  // Un résultat acté (terminé ou contesté) ne se corrige que par l'organisation :
  // l'API refuse un nouveau rapport du joueur dans ces états.
  const canReport = canSelfReport && (myMatch.status === "pending" || myMatch.status === "in-progress");
  const awaitingConfirmation = myMatch?.status === "in-progress" && iAmInMatch;

  const myScore = myMatch?.players.find((p) => p.playerId === myPlayerId)?.score ?? 0;
  const theirScore = opponentEntry?.score ?? 0;

  function submitReport(games: TournamentGameResult[]) {
    if (!myMatch || busy) return;
    if (games.length === 0) {
      setError(t("tournaments.reportGamesRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    reportMatchResult(tournamentId, myMatch.id, games, syncKey)
      .then(() => {
        setBusy(false);
        setSheetOpen(false);
        onChanged();
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  function act(action: "confirm" | "dispute") {
    if (!myMatch || busy) return;
    setBusy(true);
    setError(null);
    const fn = action === "confirm" ? confirmMatchResult : disputeMatchResult;
    fn(tournamentId, myMatch.id, syncKey)
      .then(() => {
        setBusy(false);
        onChanged();
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  if (!myMatch) {
    return (
      <p className="status muted">
        {roundExists ? t("tournaments.noMatchThisRound") : t("tournaments.notStartedYet")}
      </p>
    );
  }

  return (
    <>
      <MyMatchCard
        match={myMatch}
        myPlayerId={myPlayerId}
        opponent={opponent}
        opponentStanding={opponentStanding}
        playerName={playerName}
        deadlineAt={deadlineAt}
        scenario={scenario}
        serverOffsetMs={serverOffsetMs}
      />

      {canReport && myMatch.status === "pending" && (
        <button className="btn btn--grad btn--block btn--lg" onClick={() => setSheetOpen(true)}>
          {t("tournaments.reportAction")}
        </button>
      )}

      {awaitingConfirmation && iReported && (
        <div className="portal-notice portal-notice--pending">
          <p className="portal-notice__title">
            {t("tournaments.resultSent", { mine: myScore, theirs: theirScore })}
          </p>
          <p className="portal-notice__text">
            {t("tournaments.awaitingConfirmationFrom", { name: opponentName })}
          </p>
          {canReport && (
            <button className="btn btn--outline" onClick={() => setSheetOpen(true)} disabled={busy}>
              {t("tournaments.correctAction")}
            </button>
          )}
        </div>
      )}

      {awaitingConfirmation && !iReported && (
        <div className="portal-notice portal-notice--pending">
          <p className="portal-notice__title">
            {t("tournaments.resultReported", { mine: myScore, theirs: theirScore })}
          </p>
          <p className="portal-notice__text">{t("tournaments.confirmPrompt")}</p>
          <div className="action-row">
            <button className="btn btn--grad" disabled={busy} onClick={() => act("confirm")}>
              {t("tournaments.confirmAction")}
            </button>
            <button className="btn btn--outline" disabled={busy} onClick={() => act("dispute")}>
              {t("tournaments.disputeAction")}
            </button>
          </div>
        </div>
      )}

      {myMatch.status === "completed" && !isBye && (
        <div className="portal-notice portal-notice--done">
          <p className="portal-notice__title">
            {t("tournaments.resultRecorded", { mine: myScore, theirs: theirScore })}
          </p>
          <p className="portal-notice__text">{t("tournaments.resultLockedHint")}</p>
        </div>
      )}

      {myMatch.status === "disputed" && (
        <div className="portal-notice portal-notice--danger">
          <p className="portal-notice__title">{t("tournaments.disputedTitle")}</p>
          <p className="portal-notice__text">{t("tournaments.disputedHint")}</p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <dl className="portal-facts">
        <div className="portal-facts__row">
          <dt>{t("tournaments.myRank")}</dt>
          <dd>
            {myStanding
              ? t("tournaments.rankOf", { rank: myRankIndex + 1, total: standings.length })
              : "—"}
          </dd>
        </div>
        <div className="portal-facts__row">
          <dt>{t("tournaments.myScore")}</dt>
          <dd>
            {myStanding
              ? t("tournaments.recordLabel", {
                  wins: myStanding.wins,
                  losses: myStanding.losses,
                  draws: myStanding.draws,
                })
              : "—"}
          </dd>
        </div>
        <div className="portal-facts__row">
          <dt>{t("tournaments.myRegistration")}</dt>
          <dd>
            {myStatus === "dropped"
              ? t("tournaments.statusDropped")
              : myStatus === "pre-registered"
                ? t("tournaments.statusPreRegistered")
                : t("tournaments.statusRegistered")}
          </dd>
        </div>
      </dl>

      {otherMatches.length > 0 && (
        <>
          <p className="section-label">{t("tournaments.roundMatches")}</p>
          {otherMatches.map((m) => (
            <div key={m.id} className="match-card">
              <div className="match-card__players">
                {m.players.map((p) => (
                  <div key={p.playerId} className="match-card__player">
                    <p className="match-card__name">{playerName(p.playerId)}</p>
                    <p className="match-card__score">{p.score}</p>
                  </div>
                ))}
                {m.players.length <= 1 && <p className="muted">{t("tournaments.bye")}</p>}
              </div>
              <div className="match-card__status">
                {m.tableNumber !== undefined && (
                  <span className="chip">{t("tournaments.tableShort", { number: m.tableNumber })}</span>
                )}{" "}
                <span className={`chip status-badge ${matchStatusChipClass(m.status)}`}>
                  {t(`tournaments.matchStatus.${m.status}`)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {sheetOpen && myPlayerId && (
        <TournamentReportSheet
          match={myMatch}
          myPlayerId={myPlayerId}
          bestOf={bestOf}
          resultMode={resultMode}
          stats={stats}
          playerName={playerName}
          opponentName={opponentName}
          busy={busy}
          error={error}
          onSubmit={submitReport}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Onglet « Classement » : le classement en direct, ou celui figé à l'issue
 * d'une ronde. Un classement validé et un classement qui bouge encore ne se
 * lisent pas pareil — le bandeau le rappelle.
 */
function StandingsTab({
  liveStandings,
  flatRounds,
  statColumns,
  myPlayerId,
}: {
  liveStandings: TournamentStanding[];
  flatRounds: FlatRound[];
  /** Colonnes de statistiques du preset, dans l'ordre où elles départagent. */
  statColumns: MatchStatDefinition[];
  myPlayerId: string | undefined;
}) {
  const { t } = useTranslation();
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const validatedRounds = flatRounds.filter((entry) => entry.round.standings?.length);
  const selected = validatedRounds.find((entry) => entry.round.id === selectedRoundId) ?? null;
  const standings = selected?.round.standings ?? liveStandings;

  const myRankIndex = standings.findIndex((s) => s.playerId === myPlayerId);
  const myStanding = myRankIndex >= 0 ? standings[myRankIndex] : undefined;

  return (
    <>
      {validatedRounds.length > 0 && (
        <div className="chip-row">
          <button
            className={`chip-filter${selected === null ? " chip-filter--active" : ""}`}
            onClick={() => setSelectedRoundId(null)}
          >
            {t("tournaments.standingsLive")}
          </button>
          {validatedRounds.map(({ phase, round }) => (
            <button
              key={round.id}
              className={`chip-filter${selected?.round.id === round.id ? " chip-filter--active" : ""}`}
              onClick={() => setSelectedRoundId(round.id)}
            >
              {phase.name} · {t("tournaments.roundShort", { number: round.number })}
            </button>
          ))}
        </div>
      )}

      <p className="list-meta">
        {selected ? (
          <>
            <span className="chip status-badge">{t("tournaments.standingsFrozen")}</span>
            {selected.round.standingsValidatedAt &&
              ` · ${t("tournaments.standingsValidatedAt", {
                date: formatDateTime(selected.round.standingsValidatedAt),
              })}`}
          </>
        ) : (
          <>
            <span className="chip status-badge chip--accent">{t("tournaments.standingsLive")}</span>
            {` · ${t("tournaments.standingsLiveHint")}`}
          </>
        )}
      </p>

      {myStanding && (
        <div className="standings-me">
          <div>
            <p className="standings-me__label">{t("tournaments.you")}</p>
            <p className="standings-me__name">
              {playerTag(myStanding.displayName, myStanding.discriminator)}
            </p>
          </div>
          <div className="standings-me__score">
            <p className="standings-me__rank">{myRankIndex + 1}</p>
            <p className="standings-me__record">
              {t("tournaments.recordLabel", {
                wins: myStanding.wins,
                losses: myStanding.losses,
                draws: myStanding.draws,
              })}
            </p>
          </div>
        </div>
      )}

      {standings.length === 0 ? (
        <p className="status muted">{t("tournaments.standingsEmpty")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("tournaments.standingsPlayer")}</th>
                <th>{t("tournaments.standingsPoints")}</th>
                <th>{t("tournaments.standingsRecord")}</th>
                {statColumns.map((column) => (
                  <th key={column.key}>{t(`tournaments.matchStats.${column.labelKey}Short`)}</th>
                ))}
                <th>{t("tournaments.standingsOmw")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.playerId}
                  className={s.playerId === myPlayerId ? "standings-table__row--me" : undefined}
                >
                  <td>{i + 1}</td>
                  <td>
                    {playerTag(s.displayName, s.discriminator)}
                    {s.playerStatus === "dropped" && ` ${t("tournaments.droppedSuffix")}`}
                  </td>
                  <td>{s.matchPoints}</td>
                  <td>
                    {s.wins}-{s.losses}-{s.draws}
                  </td>
                  {statColumns.map((column) => (
                    // « — » et non « 0 » quand la statistique est absente : un
                    // classement figé avant l'ajout du preset n'en porte pas,
                    // et un zéro affiché s'y lirait comme une contre-performance.
                    <td key={column.key}>{s.stats?.[column.key] ?? "—"}</td>
                  ))}
                  <td>{((s.opponentMatchWinPercentage ?? 0) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * Accès au formulaire d'inscription, avec son état. Les réponses sont privées :
 * la fiche de tournoi ne les porte pas, il faut les demander pour savoir si le
 * joueur a répondu — c'est justement ce qu'il vient vérifier ici.
 */
function FormCard({
  tournamentId,
  myPlayerId,
  syncKey,
}: {
  tournamentId: string;
  myPlayerId: string;
  syncKey: string | undefined;
}) {
  const { t } = useTranslation();
  const form = useApi(
    () => getPlayerForm(tournamentId, myPlayerId, syncKey),
    [tournamentId, myPlayerId, syncKey],
  );

  const payload = form.data;

  // Le tournoi porte un formulaire (l'appelant l'a vérifié) : tant que l'état
  // des réponses n'est pas connu, l'accès reste affiché sans statut. Le retirer
  // sur une erreur réseau enlèverait au joueur le seul chemin vers l'écran où
  // il peut réessayer.
  if (payload && (!payload.form || payload.form.fields.length === 0)) return null;

  const answered = new Set(
    (payload?.answers ?? [])
      .filter((a) => a.text || a.number !== undefined || a.choices?.length || a.card || a.decklist)
      .map((a) => a.fieldId),
  );
  const missingRequired = payload?.form?.fields.some((f) => f.required && !answered.has(f.id));

  return (
    <Link to={`/tournaments/${tournamentId}/form`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <ScrollIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{t("tournamentForm.title")}</p>
        <p className="list-row__sub">
          {!payload ? (
            <span className="muted">
              {form.error ? t("tournamentForm.statusUnknown") : t("common.loading")}
            </span>
          ) : (
            <>
              {!payload.canEdit ? (
                <span className="chip">{t("tournamentForm.statusClosed")}</span>
              ) : missingRequired ? (
                <span className="chip chip--grad">{t("tournamentForm.statusTodo")}</span>
              ) : (
                <span className="chip chip--accent">{t("tournamentForm.statusDone")}</span>
              )}
              {payload.canEdit && payload.lateWindow && (
                <span className="chip chip--danger" style={{ marginLeft: 6 }}>
                  {t("tournamentForm.statusLate")}
                </span>
              )}
            </>
          )}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

/** Onglet « Tournoi » : ce qu'on se demande entre deux matchs. */
function InfoTab({
  tournamentId,
  detail,
  flatRounds,
  myPlayerId,
  syncKey,
  playerName,
  dropping,
  dropError,
  onLeave,
}: {
  tournamentId: string;
  detail: TournamentDetail;
  flatRounds: FlatRound[];
  myPlayerId: string | undefined;
  syncKey: string | undefined;
  playerName: (playerId: string) => string;
  dropping: boolean;
  dropError: string | null;
  onLeave: () => void;
}) {
  const { t } = useTranslation();

  const me = myPlayerId ? detail.players.find((p) => p.id === myPlayerId) : undefined;
  const activePlayers = detail.players.filter((p) => p.status !== "dropped");
  const completedRounds = flatRounds.filter((entry) => entry.round.status === "completed");
  const currentRound = flatRounds.find((entry) => entry.round.status === "in-progress");

  // Parcours personnel : une ligne par ronde jouée, tirée de l'historique déjà chargé.
  const myMatches = flatRounds.flatMap(({ round, matches }) => {
    const match = matches.find((m) => m.players.some((p) => p.playerId === myPlayerId));
    if (!match || match.status !== "completed" || !myPlayerId) return [];
    const mine = match.players.find((p) => p.playerId === myPlayerId);
    const theirs = match.players.find((p) => p.playerId !== myPlayerId);
    const won = match.winnerIds.includes(myPlayerId);
    const drew = match.winnerIds.length === 0;
    return [
      {
        id: match.id,
        roundNumber: round.number,
        opponent: theirs ? playerName(theirs.playerId) : t("tournaments.byeShort"),
        score: `${mine?.score ?? 0}–${theirs?.score ?? 0}`,
        outcome: won ? "win" : drew ? "draw" : "loss",
      },
    ];
  });

  const hasPracticalInfo = detail.location || detail.startsAt || detail.capacity;

  return (
    <>
      {myPlayerId && detail.registrationForm && (
        <FormCard tournamentId={tournamentId} myPlayerId={myPlayerId} syncKey={syncKey} />
      )}

      {hasPracticalInfo && (
        <div className="card">
          <h2 className="card__title">{t("tournaments.practicalTitle")}</h2>
          <dl className="portal-facts portal-facts--flat">
            {detail.startsAt && (
              <div className="portal-facts__row">
                <dt>{t("tournaments.startsAt")}</dt>
                <dd>{formatDateTime(detail.startsAt)}</dd>
              </div>
            )}
            {detail.location && (
              <div className="portal-facts__row">
                <dt>{t("tournaments.location")}</dt>
                <dd>{detail.location}</dd>
              </div>
            )}
            <div className="portal-facts__row">
              <dt>{t("tournaments.playersCount")}</dt>
              <dd>
                {detail.capacity
                  ? t("tournaments.playersOfCapacity", {
                      players: activePlayers.length,
                      capacity: detail.capacity,
                    })
                  : activePlayers.length}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="card">
        <h2 className="card__title">{t("tournaments.progressTitle")}</h2>
        {flatRounds.length === 0 ? (
          <p className="muted">{t("tournaments.noRoundsYet")}</p>
        ) : (
          <ul className="timeline">
            {completedRounds.length > 0 && (
              <li className="timeline__item">
                <span className="timeline__dot timeline__dot--done" />
                <span className="muted">
                  {t("tournaments.roundsCompleted", { count: completedRounds.length })}
                </span>
              </li>
            )}
            {currentRound && (
              <li className="timeline__item">
                <span className="timeline__dot timeline__dot--live" />
                <span className="timeline__label">
                  {t("tournaments.roundInProgress", { number: currentRound.round.number })} ·{" "}
                  {currentRound.phase.name}
                </span>
              </li>
            )}
            {detail.phases
              .filter((phase) => phase.status === "not-started")
              .map((phase) => (
                <li key={phase.id} className="timeline__item">
                  <span className="timeline__dot" />
                  <span className="muted">
                    {phase.name}
                    {phase.plannedRounds
                      ? ` · ${t("tournaments.plannedRounds", { count: phase.plannedRounds })}`
                      : ""}
                    {phase.topCut ? ` · ${t("tournaments.topCut", { players: phase.topCut })}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {myMatches.length > 0 && (
        <div className="card">
          <h2 className="card__title">{t("tournaments.myMatchesTitle")}</h2>
          <ul className="result-list">
            {myMatches.map((entry) => (
              <li key={entry.id} className="result-list__item">
                <span className="result-list__label">
                  {t("tournaments.roundShort", { number: entry.roundNumber })} · {entry.opponent}
                </span>
                <span className={`result-list__outcome result-list__outcome--${entry.outcome}`}>
                  {t(`tournaments.outcome.${entry.outcome}`)} {entry.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="card__title">
          {t("tournaments.playersTitle")} ({detail.players.length})
        </h2>
        {detail.players.length === 0 ? (
          <p className="muted">{t("tournaments.noPlayers")}</p>
        ) : (
          <ul className="result-list">
            {detail.players.map((player) => (
              <li key={player.id} className="result-list__item">
                <span className="result-list__label">
                  {playerTag(player.displayName, player.discriminator)}
                  {player.id === myPlayerId && ` ${t("tournaments.meSuffix")}`}
                </span>
                {player.status === "dropped" ? (
                  <span className="chip chip--danger">{t("tournaments.droppedBadge")}</span>
                ) : player.checkedInAt ? (
                  <span className="chip chip--accent">{t("tournaments.checkedInBadge")}</span>
                ) : player.status === "pre-registered" ? (
                  <span className="chip">{t("tournaments.preRegisteredBadge")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {me && me.status !== "dropped" && (
        <>
          <button className="btn btn--danger btn--block" disabled={dropping} onClick={onLeave}>
            {dropping ? t("common.saving") : t("tournaments.leaveAction")}
          </button>
          {dropError && <p className="form-error">{dropError}</p>}
        </>
      )}
    </>
  );
}

export function TournamentDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tournamentId = "" } = useParams();

  const [tab, setTab] = useState<Tab>("match");
  const [dropping, setDropping] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const {
    syncKey,
    detail,
    myPlayerId,
    loading: topLoading,
    error: topError,
    reload: reloadPlayer,
  } = useMyTournamentPlayer(tournamentId);

  const history = useApi<TournamentHistory | null>(
    () => getHistory(tournamentId, syncKey),
    [tournamentId, syncKey],
  );
  const standings = useApi(() => getStandings(tournamentId, syncKey), [tournamentId, syncKey]);

  // Un seul polling de l'état public pour tout l'écran : l'en-tête l'affiche,
  // et l'onglet « Mon match » a besoin du même décalage d'horloge pour dater
  // l'échéance de l'intervalle sans dériver de l'heure du serveur.
  const { state: liveState, serverOffsetMs } = useTournamentLive(tournamentId);

  const playerById = useMemo(
    () => new Map((detail.data?.players ?? []).map((p) => [p.id, p])),
    [detail.data],
  );
  const playerName = useMemo(() => {
    return (playerId: string): string => {
      const player = playerById.get(playerId);
      return player
        ? playerTag(player.displayName, player.discriminator)
        : t("tournaments.unknownPlayer");
    };
  }, [playerById, t]);

  // Historique à plat, dans l'ordre des phases puis des rondes.
  const flatRounds = useMemo<FlatRound[]>(
    () =>
      (history.data?.phases ?? []).flatMap(({ phase, rounds }) =>
        rounds.map(({ round, matches }) => ({ phase, round, matches })),
      ),
    [history.data],
  );

  const activePhase =
    detail.data?.phases.find((p) => p.id === detail.data?.currentPhaseId) ??
    detail.data?.phases.find((p) => p.status === "in-progress") ??
    detail.data?.phases[detail.data.phases.length - 1];

  // Ronde en cours : la dernière ronde de la phase active.
  const phaseRounds = flatRounds.filter((entry) => entry.phase.id === activePhase?.id);
  const currentRound = phaseRounds[phaseRounds.length - 1];

  const myMatch = currentRound?.matches.find((m) =>
    m.players.some((p) => p.playerId === myPlayerId),
  );
  const otherMatches = currentRound?.matches.filter((m) => m.id !== myMatch?.id) ?? [];

  const me = myPlayerId ? playerById.get(myPlayerId) : undefined;

  function leaveTournament() {
    if (!myPlayerId || dropping) return;
    setDropping(true);
    setDropError(null);
    dropSelf(tournamentId, myPlayerId, syncKey)
      .then(() => {
        setDropping(false);
        if (syncKey) removeSyncKey(tournamentId);
        navigate("/tournaments");
      })
      .catch((err: unknown) => {
        setDropping(false);
        setDropError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  function reloadMatchData() {
    history.reload();
    standings.reload();
    detail.reload();
  }

  const roundLabel = currentRound
    ? `${t("tournaments.roundLabel", { number: currentRound.round.number })} · ${currentRound.phase.name}`
    : detail.data
      ? t(`tournaments.status.${detail.data.status}`)
      : null;

  return (
    <div className="screen">
      <BackHeader title={detail.data?.name ?? t("tournaments.detailFallbackTitle")} />

      <StatusView loading={topLoading} error={topError} onRetry={reloadPlayer} />

      {detail.data && (
        <>
          <PortalHeader
            name={detail.data.name}
            roundLabel={roundLabel}
            meLabel={me ? playerTag(me.displayName, me.discriminator) : null}
            deadlineAt={currentRound?.round.deadlineAt}
            state={liveState}
            serverOffsetMs={serverOffsetMs}
          />

          <div className="segmented" style={{ marginBottom: 16 }}>
            <button
              className={`segmented__item${tab === "match" ? " segmented__item--active" : ""}`}
              onClick={() => setTab("match")}
            >
              {t("tournaments.tabMatch")}
            </button>
            <button
              className={`segmented__item${tab === "standings" ? " segmented__item--active" : ""}`}
              onClick={() => setTab("standings")}
            >
              {t("tournaments.tabStandings")}
            </button>
            <button
              className={`segmented__item${tab === "info" ? " segmented__item--active" : ""}`}
              onClick={() => setTab("info")}
            >
              {t("tournaments.tabInfo")}
            </button>
          </div>

          {tab === "match" &&
            (history.loading ? (
              <p className="status muted">{t("common.loading")}</p>
            ) : history.error ? (
              <StatusView error={history.error} onRetry={history.reload} />
            ) : (
              <MatchTab
                tournamentId={tournamentId}
                detail={detail.data}
                myPlayerId={myPlayerId}
                myMatch={myMatch}
                otherMatches={otherMatches}
                bestOf={activePhase?.bestOf ?? 1}
                resultMode={activePhase?.resultMode ?? "selection"}
                stats={presetStats(activePhase?.statsPresetKey)}
                deadlineAt={currentRound?.round.deadlineAt}
                scenario={currentRound?.round.scenario}
                serverOffsetMs={serverOffsetMs}
                standings={standings.data ?? []}
                playerName={playerName}
                playerById={playerById}
                syncKey={syncKey}
                roundExists={!!currentRound}
                onChanged={reloadMatchData}
              />
            ))}

          {tab === "standings" &&
            (standings.loading ? (
              <p className="status muted">{t("common.loading")}</p>
            ) : standings.error ? (
              <StatusView error={standings.error} onRetry={standings.reload} />
            ) : (
              <StandingsTab
                liveStandings={standings.data ?? []}
                flatRounds={flatRounds}
                statColumns={presetStats(activePhase?.statsPresetKey)}
                myPlayerId={myPlayerId}
              />
            ))}

          {tab === "info" && (
            <InfoTab
              tournamentId={tournamentId}
              detail={detail.data}
              flatRounds={flatRounds}
              myPlayerId={myPlayerId}
              syncKey={syncKey}
              playerName={playerName}
              dropping={dropping}
              dropError={dropError}
              onLeave={leaveTournament}
            />
          )}
        </>
      )}
    </div>
  );
}
