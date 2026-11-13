import { useCallback, useState } from "react";

import { appendJournal, type GameFeed } from "./game-feed";
import { useGameSocket } from "./useGameSocket";
import type { EngineTold, EngineUpdate } from "../engine/types";

/**
 * Une partie de Riftbound sur un serveur de parties (`useGameSocket` tient la
 * connexion). `url` est l'adresse WebSocket complète, ticket compris ; `renew`
 * rend une adresse fraîche quand la connexion ne revient pas.
 */
export function useOnlineGame(url: string | null, renew?: () => Promise<string | null>): GameFeed {
  const [update, setUpdate] = useState<EngineUpdate | null>(null);
  const [journal, setJournal] = useState<EngineTold[]>([]);

  const onUpdate = useCallback((message: EngineUpdate, _seen: number, fresh: boolean) => {
    const next: EngineUpdate = { seq: message.seq, view: message.view, events: message.events, prompt: message.prompt };
    if (fresh) setJournal((previous) => appendJournal(previous, next.events));
    setUpdate(next);
  }, []);

  const { status, error, seat, away, act } = useGameSocket<EngineUpdate>(url, onUpdate, renew);

  return { status, error, update, journal, seat, away, act };
}
