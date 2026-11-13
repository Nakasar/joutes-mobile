import { useCallback, useEffect, useRef, useState } from "react";

import type { SwuFeed } from "./useSwuSoloGame";
import { useGameSocket } from "../useGameSocket";
import type { SwuTableCards } from "../../engine/swu/cards";
import { tellEvents, viewCodes, type SwuJournalEntry } from "../../engine/swu/table";
import type { SwuUpdate } from "../../engine/swu/types";

/**
 * Une partie de Star Wars: Unlimited sur un serveur de parties. `url` est
 * l'adresse WebSocket complète, ticket compris ; `renew` rend une adresse
 * fraîche quand la connexion ne revient pas. `cards` sert à retrouver une
 * carte par son numéro du moteur.
 */
export function useSwuOnlineGame(
  url: string | null,
  cards: SwuTableCards,
  renew?: () => Promise<string | null>,
): SwuFeed {
  const known = useRef(new Map<number, string>());
  const byDef = useRef(new Map<number, string>());
  const [update, setUpdate] = useState<SwuUpdate | null>(null);
  const [journal, setJournal] = useState<SwuJournalEntry[]>([]);
  const [toldFrom, setToldFrom] = useState(0);

  useEffect(() => {
    byDef.current = new Map(Object.values(cards).map((card) => [card.def, card.code]));
  }, [cards]);

  const onUpdate = useCallback((message: SwuUpdate, seen: number, fresh: boolean) => {
    const next: SwuUpdate = { seq: message.seq, view: message.view, events: message.events, prompt: message.prompt };
    viewCodes(next.view, known.current);
    if (fresh) {
      const told = tellEvents(next.events, seen, known.current, byDef.current);
      setJournal((previous) => (told.length === 0 ? previous : [...previous, ...told]));
      // Arrivé en cours de partie (page rechargée, spectateur) : ce qui est
      // déjà joué va au journal sans être raconté pas à pas.
      if (seen === 0 && next.view.phase !== "setup") setToldFrom(next.seq);
    }
    setUpdate(next);
  }, []);

  const { status, error, seat, away, act } = useGameSocket<SwuUpdate>(url, onUpdate, renew);

  return { status, error, update, journal, toldFrom, seat, away, act };
}
