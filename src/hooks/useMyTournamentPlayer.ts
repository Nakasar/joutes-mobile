import { getTournament, syncTournamentKeys } from "../api/tournaments";
import type { TournamentDetail } from "../api/types";
import { getSyncKey } from "../lib/tournament-sync-storage";
import { useApi } from "./useApi";
import { useAuth } from "../store/auth";

interface UseMyTournamentPlayerResult {
  /** Clé de synchronisation locale, présente uniquement pour un joueur invité. */
  syncKey: string | undefined;
  detail: ReturnType<typeof useApi<TournamentDetail>>;
  /** Ma fiche joueur dans ce tournoi, si j'y participe. */
  myPlayerId: string | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Charge le tournoi et y retrouve ma fiche joueur, par les deux chemins
 * possibles : la clé de synchronisation d'un invité (résolue par
 * `/tournaments/sync`), ou le compte connecté rattaché à un joueur.
 *
 * Les réponses au formulaire et les clés des autres joueurs ne figurent jamais
 * dans la fiche de tournoi : savoir qui je suis est le préalable à toute
 * requête sur mes propres données.
 */
export function useMyTournamentPlayer(tournamentId: string): UseMyTournamentPlayerResult {
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

  return {
    syncKey,
    detail,
    myPlayerId,
    loading: detail.loading || (syncKey ? sync.loading : false),
    error: detail.error ?? (syncKey ? sync.error : null),
    reload: () => {
      detail.reload();
      if (syncKey) sync.reload();
    },
  };
}
