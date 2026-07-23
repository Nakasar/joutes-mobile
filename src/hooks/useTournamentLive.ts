import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveState } from "../api/tournaments";
import type { TournamentLiveState } from "../api/types";

interface UseTournamentLiveResult {
  state: TournamentLiveState | null;
  /** `new Date(serverNow).getTime() - Date.now()` au dernier chargement, pour corriger le décalage d'horloge. */
  serverOffsetMs: number;
}

/** Interroge en polling l'état public (annonces + minuteur) d'un tournoi. */
export function useTournamentLive(tournamentId: string, pollMs = 8000): UseTournamentLiveResult {
  const [state, setState] = useState<TournamentLiveState | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const idRef = useRef(tournamentId);
  idRef.current = tournamentId;

  const load = useCallback(() => {
    getLiveState(idRef.current)
      .then((data) => {
        setState(data);
        setServerOffsetMs(new Date(data.serverNow).getTime() - Date.now());
      })
      .catch(() => {
        // Best-effort : la bannière (annonces/minuteur) disparaît simplement si indisponible.
      });
  }, []);

  useEffect(() => {
    setState(null);
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [tournamentId, pollMs, load]);

  return { state, serverOffsetMs };
}
