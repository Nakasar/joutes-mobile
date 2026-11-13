import { useCallback, useEffect, useRef, useState } from "react";

import { loadSwuEngine, type SwuBrowserEngine } from "../../engine/swu/browser";
import type { SwuTableCards } from "../../engine/swu/cards";
import { tellEvents, viewCodes, type SwuJournalEntry } from "../../engine/swu/table";
import type { BotLevel, SwuAction, SwuRecord, SwuUpdate } from "../../engine/swu/types";

/**
 * Une partie de Star Wars: Unlimited contre l'IA telle qu'elle est gardée dans
 * le navigateur. `seat` est `null` pour une partie entre IA, regardée en spectateur.
 */
export type SwuSave = {
  seat: number | null;
  bots: (BotLevel | null)[];
  record: SwuRecord;
};

export const SWU_SOLO_STORAGE_KEY = "joutes.play.swu.solo";

export function readSwuSave(): SwuSave | null {
  try {
    const raw = window.localStorage.getItem(SWU_SOLO_STORAGE_KEY);
    const save = raw ? (JSON.parse(raw) as Partial<SwuSave> | null) : null;
    // Une sauvegarde d'une autre forme est oubliée plutôt que de faire tomber la page.
    if (
      !save ||
      (typeof save.seat !== "number" && save.seat !== null) ||
      !Array.isArray(save.bots) ||
      !Array.isArray(save.record?.config?.players) ||
      !Array.isArray(save.record.actions)
    ) {
      if (raw) window.localStorage.removeItem(SWU_SOLO_STORAGE_KEY);
      return null;
    }
    return save as SwuSave;
  } catch {
    return null;
  }
}

export function writeSwuSave(save: SwuSave | null): void {
  try {
    if (save) window.localStorage.setItem(SWU_SOLO_STORAGE_KEY, JSON.stringify(save));
    else window.localStorage.removeItem(SWU_SOLO_STORAGE_KEY);
  } catch {
    // Stockage refusé (navigation privée) : la partie se joue, sans reprise.
  }
}

export type { SwuJournalEntry };

/** Ce que la table reçoit de la partie. */
export type SwuFeed = {
  status: "loading" | "ready" | "reconnecting" | "error";
  error: string | null;
  update: SwuUpdate | null;
  journal: SwuJournalEntry[];
  /** La première ligne à raconter : ce qui précède est une partie reprise, déjà jouée. */
  toldFrom: number;
  /** Mon siège, ou `null` pour un spectateur. */
  seat: number | null;
  /** Sièges dont le joueur est déconnecté (en ligne seulement). */
  away?: number[];
  act: (action: SwuAction) => void;
  /**
   * La table raconte encore : les robots joués dans le navigateur attendent.
   * Absent en ligne, où la partie avance au rythme du serveur.
   */
  hold?: (busy: boolean) => void;
  /** Fait jouer tout de suite le coup suivant d'une IA (pas à pas d'une partie en pause). Absent en ligne. */
  step?: () => void;
};

const BOT_DELAY_MS = 350;

type Table = InstanceType<SwuBrowserEngine["SwuTable"]>;

/**
 * Une partie de Star Wars: Unlimited contre l'IA, jouée entièrement dans le
 * navigateur. Le journal de la partie est réécrit après chaque coup : recharger
 * la page la reprend. `cards` sert à retrouver une carte par son numéro du moteur.
 */
export function useSwuSoloGame(save: SwuSave | null, cards: SwuTableCards): SwuFeed {
  const table = useRef<Table | null>(null);
  const seen = useRef(0);
  const known = useRef(new Map<number, string>());
  const byDef = useRef(new Map<number, string>());
  const [status, setStatus] = useState<SwuFeed["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<SwuUpdate | null>(null);
  const [journal, setJournal] = useState<SwuJournalEntry[]>([]);
  const [toldFrom, setToldFrom] = useState(0);
  const [tick, setTick] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    byDef.current = new Map(Object.values(cards).map((card) => [card.def, card.code]));
  }, [cards]);

  const seat = save ? save.seat : 0;
  // Spectateur : la vue d'arbitre (-2) montre les mains des IA.
  const viewer = seat ?? -2;

  const refresh = useCallback(
    (opening = false) => {
      const current = table.current;
      if (!current || !save) return;
      try {
        const raw = JSON.parse(current.update(viewer, seen.current)) as SwuUpdate;
        // L'arbitre voit la question d'une IA : un spectateur n'y répond pas.
        const next = seat === null ? { ...raw, prompt: null } : raw;
        const first = seen.current;
        seen.current = next.seq;
        viewCodes(next.view, known.current);
        const told = tellEvents(next.events, first, known.current, byDef.current);
        setUpdate(next);
        setJournal((previous) => (told.length === 0 ? previous : [...previous, ...told]));
        // Une partie reprise ne se raconte pas depuis le début.
        if (opening) setToldFrom(next.seq);
        writeSwuSave({ ...save, record: JSON.parse(current.record()) as SwuRecord });
        setTick((value) => value + 1);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [save, seat, viewer],
  );

  useEffect(() => {
    if (!save) return;
    let cancelled = false;
    loadSwuEngine()
      .then((engine) => {
        if (cancelled) return;
        table.current = engine.SwuTable.restore(JSON.stringify(save.record), JSON.stringify(save.bots));
        seen.current = 0;
        known.current = new Map();
        setJournal([]);
        setError(null);
        setStatus("ready");
        refresh(true);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      cancelled = true;
      table.current?.free();
      table.current = null;
    };
    // La partie n'est ouverte qu'une fois par sauvegarde : `refresh` change d'identité avec elle.
  }, [save, refresh]);

  useEffect(() => {
    const current = table.current;
    if (!current || status !== "ready" || held) return;
    const next = current.to_act();
    if (next < 0 || !current.is_bot(next)) return;
    const timer = window.setTimeout(() => {
      if (table.current !== current) return;
      try {
        current.bot_step();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return;
      }
      refresh();
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [tick, status, held, refresh]);

  const act = useCallback(
    (action: SwuAction) => {
      const current = table.current;
      if (!current || seat === null) return;
      try {
        current.act(seat, JSON.stringify(action));
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      refresh();
    },
    [seat, refresh],
  );

  const step = useCallback(() => {
    const current = table.current;
    if (!current) return;
    const next = current.to_act();
    if (next < 0 || !current.is_bot(next)) return;
    try {
      current.bot_step();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    refresh();
  }, [refresh]);

  return { status, error, update, journal, toldFrom, seat, act, hold: setHeld, step };
}
