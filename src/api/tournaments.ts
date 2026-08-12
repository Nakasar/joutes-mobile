import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  TournamentDetail,
  TournamentFormAnswerInput,
  TournamentGameResult,
  TournamentHistory,
  TournamentPlayerForm,
  TournamentJoinResult,
  TournamentLiveState,
  TournamentMatch,
  TournamentPhaseDetail,
  TournamentPlayer,
  TournamentPlayingEntry,
  TournamentPlayingPage,
  TournamentStatus,
  TournamentPuzzleResult,
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

export interface PlayingTournamentsParams {
  page?: number;
  limit?: number;
  /** Recherche sur le nom du tournoi, insensible à la casse. */
  search?: string;
  /** Statuts retenus. Vide = tous. */
  statuses?: TournamentStatus[];
  gameId?: string;
  /** Commence à partir de ce jour (`AAAA-MM-JJ`), borne incluse. */
  from?: string;
  /** Commence jusqu'à ce jour compris. */
  to?: string;
}

/**
 * Les mêmes tournois, page par page et filtrés côté serveur.
 *
 * L'API rend le tableau nu tant qu'on ne lui demande rien ; c'est la page qui
 * fait basculer la réponse en enveloppe. On lui en demande donc toujours une —
 * et on sait lire les deux formes, pour qu'une API plus ancienne que cette
 * version de l'app ne laisse pas l'écran vide.
 */
export function listPlayingTournamentsPage(
  params: PlayingTournamentsParams = {},
): Promise<TournamentPlayingPage> {
  const page = params.page ?? 1;
  return api
    .get<TournamentPlayingEntry[] | Partial<TournamentPlayingPage>>(
      endpoints.tournaments.playing,
      {
        page,
        limit: params.limit,
        search: params.search,
        status: params.statuses?.length ? params.statuses.join(",") : undefined,
        gameId: params.gameId,
        from: params.from,
        to: params.to,
      },
    )
    .then((response) => {
      if (Array.isArray(response)) {
        return {
          tournaments: response,
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
        };
      }
      return {
        tournaments: response.tournaments ?? [],
        total: response.total ?? response.tournaments?.length ?? 0,
        page: response.page ?? page,
        limit: response.limit ?? params.limit ?? 0,
        totalPages: response.totalPages ?? 1,
      };
    });
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

/**
 * Historique du tournoi : phases, rondes, matchs et classement figé de chaque
 * ronde. Une seule requête pour le classement par ronde, le parcours du joueur
 * et l'avancement de la journée.
 */
export function getHistory(tournamentId: string, syncKey?: string): Promise<TournamentHistory> {
  return api.get<TournamentHistory>(
    endpoints.tournaments.history(tournamentId),
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

/**
 * Formulaire d'inscription et réponses d'un joueur. Les réponses sont privées :
 * l'API ne les sert qu'au joueur concerné et à l'organisation, et elles ne
 * figurent pas dans la fiche de tournoi renvoyée aux autres participants.
 */
export function getPlayerForm(
  tournamentId: string,
  playerId: string,
  syncKey?: string,
): Promise<TournamentPlayerForm> {
  return api.get<TournamentPlayerForm>(
    endpoints.tournaments.playerForm(tournamentId, playerId),
    undefined,
    authHeaders(syncKey),
  );
}

/**
 * Enregistre les réponses du joueur. L'envoi porte la saisie brute : l'analyse
 * d'une liste de deck et le contrôle des champs obligatoires sont faits par le
 * serveur, qui renvoie l'état à jour du formulaire.
 */
export function savePlayerForm(
  tournamentId: string,
  playerId: string,
  answers: TournamentFormAnswerInput[],
  syncKey?: string,
): Promise<TournamentPlayerForm> {
  return api.put<TournamentPlayerForm>(
    endpoints.tournaments.playerForm(tournamentId, playerId),
    { answers },
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

/** Temps relevés sur le puzzle d'une phase, du plus rapide au plus lent. */
export function getPuzzleResults(
  tournamentId: string,
  phaseId: string,
  syncKey?: string,
): Promise<TournamentPuzzleResult[]> {
  return api.get<TournamentPuzzleResult[]>(
    endpoints.tournaments.puzzleResults(tournamentId, phaseId),
    undefined,
    authHeaders(syncKey),
  );
}

/**
 * Signale que le joueur vient de terminer le puzzle : le serveur relève le
 * temps courant du chronomètre de la salle. Le joueur ne choisit pas son temps
 * — seule l'organisation peut le corriger ensuite.
 */
export function reportPuzzleFinished(
  tournamentId: string,
  phaseId: string,
  syncKey?: string,
): Promise<TournamentPuzzleResult> {
  return api.post<TournamentPuzzleResult>(
    endpoints.tournaments.puzzleResults(tournamentId, phaseId),
    {},
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
