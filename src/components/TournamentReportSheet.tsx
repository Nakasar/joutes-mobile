import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  TournamentGameResult,
  TournamentMatch,
  TournamentResultMode,
} from "../api/types";
import { buildQuickResults, type QuickResult } from "../lib/tournament-quick-results";
import type { MatchStatDefinition } from "../lib/tournament-presets";

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
  stats = [],
  requireStats = false,
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
  /** Statistiques secondaires à relever. Vide = la phase n'en demande pas. */
  stats?: MatchStatDefinition[];
  /**
   * La phase exige leur saisie : chaque partie rapportée porte toutes les
   * statistiques, pour chaque joueur, sans quoi l'API refuse le résultat.
   */
  requireStats?: boolean;
  playerName: (playerId: string) => string;
  opponentName: string;
  busy: boolean;
  error: string | null;
  onSubmit: (games: TournamentGameResult[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const matchPlayerIds = match.players.map((p) => p.playerId);
  // Les raccourcis ne savent pas porter de statistiques : dès que la phase en
  // relève, la saisie détaillée est le seul chemin complet.
  const quickResults =
    resultMode === "selection" && stats.length === 0
      ? buildQuickResults(bestOf, matchPlayerIds)
      : [];

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
              stats={stats}
              requireStats={requireStats}
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
  stats,
  requireStats,
  playerName,
  busy,
  onSubmit,
}: {
  match: TournamentMatch;
  bestOf: number;
  resultMode: TournamentResultMode;
  stats: MatchStatDefinition[];
  requireStats: boolean;
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

  /**
   * Statistiques secondaires : elles ne décident jamais d'une partie, elles s'y
   * accrochent. Une partie sans issue renseignée n'est donc pas créée par la
   * seule saisie d'une statistique.
   *
   * La valeur est bornée et arrondie ici : `min`/`max` sur un champ HTML
   * n'empêchent pas la frappe, et l'API refuse un entier hors de [0, 9999] —
   * mieux vaut brider la saisie qu'afficher au joueur une erreur de validation.
   * Une statistique effacée est retirée de l'objet, et un joueur sans aucune
   * statistique est retiré du lot : le serveur complète à zéro ce qu'il reçoit,
   * envoyer un objet vide reviendrait à enregistrer des zéros non saisis.
   */
  function setStat(gameIndex: number, playerId: string, key: string, value: string, max: number) {
    setGames((prev) => {
      const next = [...prev];
      const game = next[gameIndex];
      if (!game) return prev;

      const playerStats = { ...(game.stats?.[playerId] ?? {}) };
      const parsed = Number(value);
      if (value.trim() === "" || !Number.isFinite(parsed)) {
        delete playerStats[key];
      } else {
        playerStats[key] = Math.min(max, Math.max(0, Math.round(parsed)));
      }

      const allStats = { ...(game.stats ?? {}) };
      if (Object.keys(playerStats).length > 0) {
        allStats[playerId] = playerStats;
      } else {
        delete allStats[playerId];
      }

      next[gameIndex] = Object.keys(allStats).length > 0
        ? { ...game, stats: allStats }
        : { winnerId: game.winnerId, points: game.points };
      return next;
    });
  }

  const decided = games.filter((g): g is TournamentGameResult => g !== undefined);

  // Statistiques exigées : chaque partie rapportée les porte toutes, pour
  // chaque joueur. On bloque l'envoi ici plutôt que de laisser l'API refuser le
  // résultat une fois la feuille refermée.
  const statsIncomplete =
    requireStats &&
    stats.length > 0 &&
    decided.some((game) =>
      match.players.some((p) =>
        stats.some((stat) => typeof game.stats?.[p.playerId]?.[stat.key] !== "number"),
      ),
    );

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
          {stats.length > 0 && game !== undefined && (
            <div className="game-picker__stats">
              {match.players.map((p) => (
                <div key={p.playerId} className="game-picker__stat-row">
                  <span className="game-picker__stat-name">{playerName(p.playerId)}</span>
                  {stats.map((stat) => (
                    <input
                      key={stat.key}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={stat.max}
                      className="game-picker__stat-input"
                      placeholder={t(`tournaments.matchStats.${stat.labelKey}Short`)}
                      aria-label={t("tournaments.matchStatAria", {
                        stat: t(`tournaments.matchStats.${stat.labelKey}`),
                        name: playerName(p.playerId),
                        number: i + 1,
                      })}
                      value={game.stats?.[p.playerId]?.[stat.key] ?? ""}
                      onChange={(e) => setStat(i, p.playerId, stat.key, e.currentTarget.value, stat.max)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {stats.length > 0 && (
        <p className="status muted">
          {t(requireStats ? "tournaments.matchStatsRequired" : "tournaments.matchStatsOptional", {
            stats: stats.map((stat) => t(`tournaments.matchStats.${stat.labelKey}`)).join(", "),
          })}
        </p>
      )}
      {statsIncomplete && <p className="form-error">{t("tournaments.matchStatsMissing")}</p>}
      <button
        type="button"
        className="btn btn--grad btn--block"
        onClick={() => onSubmit(decided)}
        disabled={busy || decided.length === 0 || statsIncomplete}
      >
        {busy ? t("common.saving") : t("tournaments.reportSubmit")}
      </button>
    </div>
  );
}
