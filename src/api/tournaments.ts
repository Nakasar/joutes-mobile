import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  TournamentDetail,
  TournamentGameResult,
  TournamentMatch,
  TournamentPhaseDetail,
  TournamentRoundDetail,
  TournamentStanding,
  TournamentSyncEntry,
} from "./types";

function authHeaders(syncKey?: string): Record<string, string> | undefined {
  return syncKey ? { Authorization: `Bearer ${syncKey}` } : undefined;
}

/**
 * Résout un lot de clés de synchronisation (`tpsk_...`) en tournois + joueurs.
 * Les clés inconnues sont silencieusement ignorées par l'API.
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
