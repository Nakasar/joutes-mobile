import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  TournamentDetail,
  TournamentGameResult,
  TournamentJoinResult,
  TournamentLiveState,
  TournamentMatch,
  TournamentPhaseDetail,
  TournamentPlayer,
  TournamentPlayingEntry,
  TournamentRoundDetail,
  TournamentStanding,
  TournamentSyncEntry,
} from "./types";

function authHeaders(syncKey?: string): Record<string, string> | undefined {
  return syncKey ? { Authorization: `Bearer ${syncKey}` } : undefined;
}

/**
 * Rejoint un tournoi via son code public (`Tournament.joinCode`). Avec une
 * session active, aucun secret n'est renvoyé (le joueur est lié au compte) ;
 * sans session, `displayName` est requis et la réponse contient la clé de
 * synchronisation (`tpsk_...`) à conserver localement pour cet invité.
 */
export function joinTournament(input: { code: string; displayName?: string }): Promise<TournamentJoinResult> {
  return api.post<TournamentJoinResult>(endpoints.tournaments.join, input);
}

/** Tournois où l'utilisateur connecté est inscrit (session requise). */
export function listPlayingTournaments(): Promise<TournamentPlayingEntry[]> {
  return api.get<TournamentPlayingEntry[]>(endpoints.tournaments.playing);
}

/**
 * Résout un lot de clés de synchronisation d'invités (`tpsk_...`) en tournois
 * + joueurs. Les clés inconnues sont silencieusement ignorées par l'API.
 */
export function syncTournamentKeys(keys: string[]): Promise<TournamentSyncEntry[]> {
  if (keys.length === 0) return Promise.resolve([]);
  return api.post<TournamentSyncEntry[]>(endpoints.tournaments.sync, { keys });
}

export function getTournament(tournamentId: string, syncKey?: string): Promise<TournamentDetail> {
  return api.get<TournamentDetail>(
    endpoints.tournaments.detail(tournamentId),
    undefined,
    authHeaders(syncKey),
  );
}

/** État public (annonces + minuteur) — sans authentification, à interroger en polling. */
export function getLiveState(tournamentId: string): Promise<TournamentLiveState> {
  return api.get<TournamentLiveState>(endpoints.tournaments.live(tournamentId));
}

export function getStandings(
  tournamentId: string,
  syncKey?: string,
): Promise<TournamentStanding[]> {
  return api.get<TournamentStanding[]>(
    endpoints.tournaments.standings(tournamentId),
    undefined,
    authHeaders(syncKey),
  );
}

export function getPhase(
  tournamentId: string,
  phaseId: string,
  syncKey?: string,
): Promise<TournamentPhaseDetail> {
  return api.get<TournamentPhaseDetail>(
    endpoints.tournaments.phase(tournamentId, phaseId),
    undefined,
    authHeaders(syncKey),
  );
}

export function getRound(
  tournamentId: string,
  roundId: string,
  syncKey?: string,
): Promise<TournamentRoundDetail> {
  return api.get<TournamentRoundDetail>(
    endpoints.tournaments.round(tournamentId, roundId),
    undefined,
    authHeaders(syncKey),
  );
}

/** Se retire du tournoi (seule action self-service permise sur sa propre fiche joueur). */
export function dropSelf(
  tournamentId: string,
  playerId: string,
  syncKey?: string,
): Promise<TournamentPlayer> {
  return api.patch<TournamentPlayer>(
    endpoints.tournaments.player(tournamentId, playerId),
    { status: "dropped" },
    authHeaders(syncKey),
  );
}

export function reportMatchResult(
  tournamentId: string,
  matchId: string,
  games: TournamentGameResult[],
  syncKey?: string,
): Promise<TournamentMatch> {
  return api.patch<TournamentMatch>(
    endpoints.tournaments.match(tournamentId, matchId),
    { action: "report", games },
    authHeaders(syncKey),
  );
}

export function confirmMatchResult(
  tournamentId: string,
  matchId: string,
  syncKey?: string,
): Promise<TournamentMatch> {
  return api.patch<TournamentMatch>(
    endpoints.tournaments.match(tournamentId, matchId),
    { action: "confirm" },
    authHeaders(syncKey),
  );
}

export function disputeMatchResult(
  tournamentId: string,
  matchId: string,
  syncKey?: string,
): Promise<TournamentMatch> {
  return api.patch<TournamentMatch>(
    endpoints.tournaments.match(tournamentId, matchId),
    { action: "dispute" },
    authHeaders(syncKey),
  );
}
