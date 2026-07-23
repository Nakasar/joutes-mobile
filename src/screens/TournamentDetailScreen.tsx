import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmMatchResult,
  disputeMatchResult,
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
import { getSyncKey } from "../lib/tournament-sync-storage";
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
  syncKey: string;
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
    const n = Number(value);
    setGames((prev) => {
      const next = [...prev];
      const current = next[gameIndex]?.points ?? {};
      next[gameIndex] = { points: { ...current, [playerId]: Number.isFinite(n) ? n : 0 } };
      return next;
    });
  }

  const decided = games.filter((g): g is TournamentGameResult => g !== undefined);

  function submit() {
    if (decided.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    reportMatchResult(tournamentId, match.id, decided, syncKey)
      .then(onReported)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setSaving(false));
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
  syncKey: string;
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
      .then(onChanged)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => setBusy(false));
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
  const { tournamentId = "" } = useParams();
  const syncKey = getSyncKey(tournamentId);

  const sync = useApi(
    () => (syncKey ? syncTournamentKeys([syncKey]) : Promise.resolve([])),
    [tournamentId, syncKey],
  );
  const myEntry = sync.data?.[0];
  const myPlayerId = myEntry?.player.id;

  const detail = useApi(
    () => getTournament(tournamentId, syncKey),
    [tournamentId, syncKey],
  );

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
    () => (syncKey ? getStandings(tournamentId, syncKey) : Promise.resolve([])),
    [tournamentId, syncKey],
  );

  function playerName(playerId: string): string {
    return detail.data?.players.find((p) => p.id === playerId)?.displayName ?? "?";
  }

  const myMatch = round.data?.matches.find((m) => m.players.some((p) => p.playerId === myPlayerId));
  const otherMatches = round.data?.matches.filter((m) => m.id !== myMatch?.id) ?? [];

  if (!syncKey) {
    return (
      <div className="screen">
        <BackHeader title={t("tournaments.detailFallbackTitle")} />
        <div className="card gate">
          <h2 className="gate__title">{t("tournaments.notJoinedTitle")}</h2>
          <p className="gate__text">{t("tournaments.notJoinedText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <BackHeader title={detail.data?.name ?? myEntry?.tournament.name ?? t("tournaments.detailFallbackTitle")} />
      <StatusView loading={detail.loading || sync.loading} error={detail.error} onRetry={detail.reload} />

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
          {myMatch ? (
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
        </>
      )}
    </div>
  );
}
