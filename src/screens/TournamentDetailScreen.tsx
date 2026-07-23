import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmMatchResult,
  disputeMatchResult,
  dropSelf,
  getPhase,
  getRound,
  getStandings,
  getTournament,
  reportMatchResult,
  syncTournamentKeys,
} from "../api/tournaments";
import type {
  TournamentGameResult,
  TournamentMatch,
  TournamentMatchStatus,
  TournamentResultMode,
  TournamentStanding,
} from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useTournamentLive } from "../hooks/useTournamentLive";
import { formatDuration, timerIsPaused, timerRemainingSeconds } from "../lib/tournament-timer";
import { getSyncKey, removeSyncKey } from "../lib/tournament-sync-storage";
import { useAuth } from "../store/auth";
import { tournamentStatusChipClass } from "./TournamentsScreen";

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

function LiveBanner({ tournamentId }: { tournamentId: string }) {
  const { t } = useTranslation();
  const { state, serverOffsetMs } = useTournamentLive(tournamentId);
  const remaining = timerRemainingSeconds(state?.timer, serverOffsetMs);

  if (!state || (state.announcements.length === 0 && remaining === null)) return null;

  return (
    <div className="live-banner">
      {state.announcements.map((a) => (
        <p key={a.id} className={`live-banner__announcement${a.level === "urgent" ? " live-banner__announcement--urgent" : ""}`}>
          {a.message}
        </p>
      ))}
      {remaining !== null && (
        <p className={`live-banner__timer${remaining < 0 ? " live-banner__timer--expired" : ""}`}>
          {formatDuration(remaining)}
          {timerIsPaused(state.timer) && ` (${t("tournaments.timerPaused")})`}
        </p>
      )}
    </div>
  );
}

function ReportMatchForm({
  tournamentId,
  match,
  bestOf,
  resultMode,
  syncKey,
  playerName,
  onReported,
}: {
  tournamentId: string;
  match: TournamentMatch;
  bestOf: number;
  resultMode: TournamentResultMode;
  syncKey: string | undefined;
  playerName: (playerId: string) => string;
  onReported: () => void;
}) {
  const { t } = useTranslation();
  const [games, setGames] = useState<Array<TournamentGameResult | undefined>>(() =>
    Array.from({ length: Math.max(1, bestOf) }, () => undefined),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setWinner(gameIndex: number, winnerId: string | null) {
    setGames((prev) => {
      const next = [...prev];
      next[gameIndex] = { winnerId };
      return next;
    });
  }

  function setPoints(gameIndex: number, playerId: string, value: string) {
    setGames((prev) => {
      const next = [...prev];
      const current = { ...(next[gameIndex]?.points ?? {}) };
      if (value.trim() === "") {
        delete current[playerId];
      } else {
        const n = Number(value);
        if (Number.isFinite(n)) current[playerId] = n;
      }
      next[gameIndex] = Object.keys(current).length > 0 ? { points: current } : undefined;
      return next;
    });
  }

  const decided = games.filter((g): g is TournamentGameResult => g !== undefined);

  function submit() {
    if (decided.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    reportMatchResult(tournamentId, match.id, decided, syncKey)
      .then(() => {
        setSaving(false);
        onReported();
      })
      .catch((err: unknown) => {
        setSaving(false);
        setError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  return (
    <div className="game-picker">
      {games.map((game, i) => (
        <div key={i} className="game-picker__row">
          <span className="game-picker__label">{t("tournaments.gameLabel", { number: i + 1 })}</span>
          <div className="game-picker__options">
            {resultMode === "selection" ? (
              <>
                {match.players.map((p) => (
                  <button
                    key={p.playerId}
                    type="button"
                    className={`game-picker__option${game?.winnerId === p.playerId ? " game-picker__option--selected" : ""}`}
                    onClick={() => setWinner(i, p.playerId)}
                  >
                    {playerName(p.playerId)}
                  </button>
                ))}
                <button
                  type="button"
                  className={`game-picker__option${game !== undefined && game.winnerId === null ? " game-picker__option--selected" : ""}`}
                  onClick={() => setWinner(i, null)}
                >
                  {t("tournaments.draw")}
                </button>
              </>
            ) : (
              match.players.map((p) => (
                <input
                  key={p.playerId}
                  type="number"
                  inputMode="numeric"
                  className="game-picker__option"
                  placeholder={playerName(p.playerId)}
                  value={game?.points?.[p.playerId] ?? ""}
                  onChange={(e) => setPoints(i, p.playerId, e.currentTarget.value)}
                />
              ))
            )}
          </div>
        </div>
      ))}
      {error && <p className="form-error">{error}</p>}
      <button
        className="btn btn--grad btn--block"
        onClick={submit}
        disabled={saving || decided.length === 0}
      >
        {saving ? t("common.saving") : t("tournaments.reportSubmit")}
      </button>
    </div>
  );
}

function MyMatchCard({
  tournamentId,
  match,
  myPlayerId,
  playerName,
  bestOf,
  resultMode,
  allowSelfReporting,
  syncKey,
  onChanged,
}: {
  tournamentId: string;
  match: TournamentMatch;
  myPlayerId: string | undefined;
  playerName: (playerId: string) => string;
  bestOf: number;
  resultMode: TournamentResultMode;
  allowSelfReporting: boolean;
  syncKey: string | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBye = match.players.length <= 1;
  const iAmInMatch = match.players.some((p) => p.playerId === myPlayerId);
  const canReport =
    !isBye && match.status === "pending" && allowSelfReporting && iAmInMatch;
  const awaitingConfirmation = match.status === "in-progress" && iAmInMatch;
  const iReported = match.reportedBy === myPlayerId;

  function act(action: "confirm" | "dispute") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const fn = action === "confirm" ? confirmMatchResult : disputeMatchResult;
    fn(tournamentId, match.id, syncKey)
      .then(() => {
        setBusy(false);
        onChanged();
      })
      .catch((err: unknown) => {
        setBusy(false);
        setError(err instanceof Error ? err.message : t("common.error"));
      });
  }

  return (
    <div className="match-card">
      <div className="match-card__players">
        {match.players.map((p) => (
          <div
            key={p.playerId}
            className={`match-card__player${p.playerId === myPlayerId ? " match-card__player--me" : ""}`}
          >
            <p className="match-card__name">{playerName(p.playerId)}</p>
            <p className="match-card__score">{p.score}</p>
          </div>
        ))}
        {isBye && <p className="muted">{t("tournaments.bye")}</p>}
      </div>

      <div className="match-card__status">
        <span className={`chip status-badge ${matchStatusChipClass(match.status)}`}>
          {t(`tournaments.matchStatus.${match.status}`)}
        </span>
      </div>

      {canReport && (
        <ReportMatchForm
          tournamentId={tournamentId}
          match={match}
          bestOf={bestOf}
          resultMode={resultMode}
          syncKey={syncKey}
          playerName={playerName}
          onReported={onChanged}
        />
      )}

      {awaitingConfirmation && !canReport && (
        <div className="action-row">
          {!iReported && (
            <button className="btn btn--grad" disabled={busy} onClick={() => act("confirm")}>
              {t("tournaments.confirmAction")}
            </button>
          )}
          <button className="btn btn--outline" disabled={busy} onClick={() => act("dispute")}>
            {t("tournaments.disputeAction")}
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function StandingsTable({
  standings,
  myPlayerId,
}: {
  standings: TournamentStanding[];
  myPlayerId: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("tournaments.standingsPlayer")}</th>
            <th>{t("tournaments.standingsPoints")}</th>
            <th>{t("tournaments.standingsRecord")}</th>
            <th>{t("tournaments.standingsDiff")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr
              key={s.playerId}
              className={s.playerId === myPlayerId ? "standings-table__row--me" : undefined}
            >
              <td>{i + 1}</td>
              <td>{s.displayName}</td>
              <td>{s.matchPoints}</td>
              <td>
                {s.wins}-{s.losses}-{s.draws}
              </td>
              <td>{s.gamesDiff > 0 ? `+${s.gamesDiff}` : s.gamesDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TournamentDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tournamentId = "" } = useParams();
  const { user } = useAuth();
  const syncKey = getSyncKey(tournamentId);

  const detail = useApi(() => getTournament(tournamentId, syncKey), [tournamentId, syncKey]);

  const sync = useApi(
    () => (syncKey ? syncTournamentKeys([syncKey]) : Promise.resolve([])),
    [tournamentId, syncKey],
  );
  const myPlayerId = syncKey
    ? sync.data?.[0]?.player.id
    : detail.data?.players.find((p) => p.userId === user?.id)?.id;
  const myPlayer = detail.data?.players.find((p) => p.id === myPlayerId);

  const activePhaseId =
    detail.data?.currentPhaseId ??
    detail.data?.phases.find((p) => p.status === "in-progress")?.id ??
    detail.data?.phases[detail.data.phases.length - 1]?.id;
  const activePhase = detail.data?.phases.find((p) => p.id === activePhaseId);

  const phase = useApi(
    () => (activePhaseId ? getPhase(tournamentId, activePhaseId, syncKey) : Promise.resolve(null)),
    [tournamentId, activePhaseId, syncKey],
  );
  const lastRound = phase.data?.rounds[phase.data.rounds.length - 1];

  const round = useApi(
    () => (lastRound ? getRound(tournamentId, lastRound.id, syncKey) : Promise.resolve(null)),
    [tournamentId, lastRound?.id, syncKey],
  );

  const standings = useApi(
    () => getStandings(tournamentId, syncKey),
    [tournamentId, syncKey],
  );

  const [dropping, setDropping] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

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

  function playerName(playerId: string): string {
    return detail.data?.players.find((p) => p.id === playerId)?.displayName ?? "?";
  }

  const myMatch = round.data?.matches.find((m) => m.players.some((p) => p.playerId === myPlayerId));
  const otherMatches = round.data?.matches.filter((m) => m.id !== myMatch?.id) ?? [];

  const topLoading = detail.loading || (syncKey ? sync.loading : false);
  const topError = detail.error ?? (syncKey ? sync.error : null);

  return (
    <div className="screen">
      <BackHeader title={detail.data?.name ?? t("tournaments.detailFallbackTitle")} />
      <LiveBanner tournamentId={tournamentId} />
      <StatusView
        loading={topLoading}
        error={topError}
        onRetry={() => {
          detail.reload();
          if (syncKey) sync.reload();
        }}
      />

      {detail.data && (
        <>
          <p className="list-meta">
            <span className={`chip status-badge ${tournamentStatusChipClass(detail.data.status)}`}>
              {t(`tournaments.status.${detail.data.status}`)}
            </span>
            {activePhase && ` · ${activePhase.name}`}
            {round.data && ` · ${t("tournaments.roundLabel", { number: round.data.number })}`}
          </p>

          <p className="section-label">{t("tournaments.myMatch")}</p>
          {phase.loading || round.loading ? (
            <p className="status muted">{t("common.loading")}</p>
          ) : phase.error || round.error ? (
            <div className="status">
              <p className="form-error">{phase.error ?? round.error}</p>
              <button
                className="btn btn--grad"
                style={{ marginTop: 12 }}
                onClick={() => {
                  phase.reload();
                  round.reload();
                }}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : myMatch ? (
            <MyMatchCard
              tournamentId={tournamentId}
              match={myMatch}
              myPlayerId={myPlayerId}
              playerName={playerName}
              bestOf={activePhase?.bestOf ?? 1}
              resultMode={activePhase?.resultMode ?? "selection"}
              allowSelfReporting={detail.data.settings.allowSelfReporting}
              syncKey={syncKey}
              onChanged={() => {
                round.reload();
                standings.reload();
              }}
            />
          ) : (
            <p className="status muted">
              {round.data ? t("tournaments.noMatchThisRound") : t("tournaments.notStartedYet")}
            </p>
          )}

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
                  <span className={`chip status-badge ${matchStatusChipClass(m.status)}`}>
                    {t(`tournaments.matchStatus.${m.status}`)}
                  </span>
                </div>
              ))}
            </>
          )}

          <p className="section-label">{t("tournaments.standingsTitle")}</p>
          <StatusView
            loading={standings.loading}
            error={standings.error}
            onRetry={standings.reload}
            empty={standings.data && standings.data.length === 0 ? t("tournaments.standingsEmpty") : undefined}
          />
          {standings.data && standings.data.length > 0 && (
            <StandingsTable standings={standings.data} myPlayerId={myPlayerId} />
          )}

          {myPlayer && myPlayer.status !== "dropped" && (
            <>
              <button
                className="btn btn--danger"
                style={{ marginTop: 16 }}
                disabled={dropping}
                onClick={leaveTournament}
              >
                {dropping ? t("common.saving") : t("tournaments.leaveAction")}
              </button>
              {dropError && <p className="form-error">{dropError}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
