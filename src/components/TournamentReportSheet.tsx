import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  TournamentGameResult,
  TournamentMatch,
  TournamentResultMode,
} from "../api/types";
import { buildQuickResults, type QuickResult } from "../lib/tournament-quick-results";

/**
 * Saisie du résultat, en feuille de bas d'écran.
 *
 * Le chemin normal tient en deux touches : ouvrir, choisir une issue libellée
 * « j'ai gagné » / « <adversaire> a gagné » plutôt qu'en scores abstraits. La
 * saisie partie par partie reste accessible dessous, et devient le seul mode
 * quand les raccourcis ne s'appliquent pas (format en points, match
 * multijoueur).
 */
export function TournamentReportSheet({
  match,
  myPlayerId,
  bestOf,
  resultMode,
  playerName,
  opponentName,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  match: TournamentMatch;
  myPlayerId: string;
  bestOf: number;
  resultMode: TournamentResultMode;
  playerName: (playerId: string) => string;
  opponentName: string;
  busy: boolean;
  error: string | null;
  onSubmit: (games: TournamentGameResult[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const matchPlayerIds = match.players.map((p) => p.playerId);
  const quickResults =
    resultMode === "selection" ? buildQuickResults(bestOf, matchPlayerIds) : [];

  // Sans raccourci applicable, la saisie détaillée est le seul mode : on l'ouvre
  // directement plutôt que d'afficher une feuille vide.
  const [detailed, setDetailed] = useState(quickResults.length === 0);

  const myIndex = matchPlayerIds.indexOf(myPlayerId);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__body">
          <h2 className="report-sheet__title">{t("tournaments.reportWhoWon")}</h2>
          <p className="report-sheet__sub">
            {match.tableNumber !== undefined
              ? t("tournaments.reportTableAndOpponent", {
                  table: match.tableNumber,
                  name: opponentName,
                })
              : t("tournaments.reportAgainst", { name: opponentName })}
          </p>

          {!detailed && (
            <div className="report-sheet__options">
              {quickResults.map((result) => (
                <QuickResultButton
                  key={result.key}
                  result={result}
                  myIndex={myIndex}
                  opponentName={opponentName}
                  busy={busy}
                  onPick={() => onSubmit(result.games)}
                />
              ))}
            </div>
          )}

          {detailed && (
            <DetailedResultForm
              match={match}
              bestOf={bestOf}
              resultMode={resultMode}
              playerName={playerName}
              busy={busy}
              onSubmit={onSubmit}
            />
          )}

          {error && <p className="form-error">{error}</p>}

          {quickResults.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => setDetailed((value) => !value)}
              disabled={busy}
            >
              {detailed ? t("tournaments.reportBackToQuick") : t("tournaments.reportDetailed")}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--block" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Le score est toujours présenté du point de vue du joueur : son total
 * d'abord, pour qu'il n'ait pas à le retourner mentalement.
 */
function QuickResultButton({
  result,
  myIndex,
  opponentName,
  busy,
  onPick,
}: {
  result: QuickResult;
  myIndex: number;
  opponentName: string;
  busy: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const isDraw = result.winnerIndex === null;
  const iWon = result.winnerIndex === myIndex;
  const myScore = result.scores[myIndex] ?? 0;
  const theirScore = result.scores[myIndex === 0 ? 1 : 0] ?? 0;

  return (
    <button type="button" className="report-option" disabled={busy} onClick={onPick}>
      <span className="report-option__label">
        {isDraw
          ? t("tournaments.draw")
          : iWon
            ? t("tournaments.reportIWon")
            : t("tournaments.reportOpponentWon", { name: opponentName })}
      </span>
      {!isDraw && (
        <span className="report-option__score">
          {myScore} – {theirScore}
        </span>
      )}
    </button>
  );
}

/** Saisie partie par partie : formats en points, matchs multijoueurs, corrections. */
function DetailedResultForm({
  match,
  bestOf,
  resultMode,
  playerName,
  busy,
  onSubmit,
}: {
  match: TournamentMatch;
  bestOf: number;
  resultMode: TournamentResultMode;
  playerName: (playerId: string) => string;
  busy: boolean;
  onSubmit: (games: TournamentGameResult[]) => void;
}) {
  const { t } = useTranslation();
  const [games, setGames] = useState<Array<TournamentGameResult | undefined>>(() =>
    Array.from({ length: Math.max(1, bestOf) }, () => undefined),
  );

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
      <button
        type="button"
        className="btn btn--grad btn--block"
        onClick={() => onSubmit(decided)}
        disabled={busy || decided.length === 0}
      >
        {busy ? t("common.saving") : t("tournaments.reportSubmit")}
      </button>
    </div>
  );
}
