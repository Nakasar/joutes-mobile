import type { SoloMeta } from "./history";
import { useCallback, useEffect, useRef, useState } from "react";

import { appendJournal, type GameFeed } from "./game-feed";
import { loadEngine, type BrowserEngine } from "../engine/browser";
import type { BotLevel, EngineAction, EngineRecord, EngineTold, EngineUpdate } from "../engine/types";

/**
 * Une partie contre l'IA telle qu'elle est gardée dans le navigateur. `seat`
 * est `null` pour une partie entre IA, regardée en spectateur.
 */
export type SoloSave = {
  seat: number | null;
  bots: (BotLevel | null)[];
  record: EngineRecord;
  /** Le deck et l'IA choisis, pour l'accueil et l'historique. */
  meta?: SoloMeta;
};

export const SOLO_STORAGE_KEY = "joutes.play.solo";

export function readSoloSave(): SoloSave | null {
  try {
    const raw = window.localStorage.getItem(SOLO_STORAGE_KEY);
    const save = raw ? (JSON.parse(raw) as Partial<SoloSave> | null) : null;
    // Une sauvegarde d'une autre forme (ancienne version, valeur abîmée) est
    // oubliée : la lire telle quelle ferait tomber la page à chaque visite.
    if (
      !save ||
      (typeof save.seat !== "number" && save.seat !== null) ||
      !Array.isArray(save.bots) ||
      typeof save.record?.config?.mode !== "string" ||
      !Array.isArray(save.record.config.players) ||
      !Array.isArray(save.record.actions)
    ) {
      if (raw) window.localStorage.removeItem(SOLO_STORAGE_KEY);
      return null;
    }
    return save as SoloSave;
  } catch {
    return null;
  }
}

export function writeSoloSave(save: SoloSave | null): void {
  try {
    if (save) window.localStorage.setItem(SOLO_STORAGE_KEY, JSON.stringify(save));
    else window.localStorage.removeItem(SOLO_STORAGE_KEY);
  } catch {
    // Stockage refusé (navigation privée) : la partie se joue, sans reprise.
  }
}

/**
 * Le temps laissé entre la fin du récit d'un coup du robot et le suivant. Le
 * récit lui-même (`usePacedFeed`) prend le temps de montrer chaque évènement.
 */
const BOT_DELAY_MS = 500;

type Table = InstanceType<BrowserEngine["Table"]>;

/**
 * Une partie contre l'IA, jouée entièrement dans le navigateur. Le journal de
 * la partie est réécrit après chaque coup : recharger la page la reprend.
 */
export function useSoloGame(save: SoloSave | null, options: { hands?: boolean } = {}): GameFeed {
  const table = useRef<Table | null>(null);
  const seen = useRef(0);
  const [status, setStatus] = useState<GameFeed["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<EngineUpdate | null>(null);
  const [journal, setJournal] = useState<EngineTold[]>([]);
  // Incrémenté à chaque changement d'état du moteur : relance l'effet des robots.
  const [tick, setTick] = useState(0);
  // La table raconte encore le coup précédent : le robot attend.
  const [held, setHeld] = useState(false);

  const seat = save ? save.seat : 0;
  // Spectateur : la vue d'arbitre (-2) montre les mains des IA, celle de
  // spectateur (-1) les cache.
  const viewer = seat ?? (options.hands ? -2 : -1);

  const refresh = useCallback(() => {
    const current = table.current;
    if (!current || !save) return;
    try {
      const raw = JSON.parse(current.update(viewer, seen.current)) as EngineUpdate;
      // L'arbitre voit la question d'une IA : un spectateur n'y répond pas.
      const next = seat === null ? { ...raw, prompt: null } : raw;
      seen.current = next.seq;
      setUpdate(next);
      setJournal((previous) => appendJournal(previous, next.events));
      writeSoloSave({ ...save, record: JSON.parse(current.record()) as EngineRecord });
      setTick((value) => value + 1);
    } catch (cause) {
      // Le moteur a levé une erreur : la dire plutôt que de laisser la table figée.
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [save, seat, viewer]);

  useEffect(() => {
    if (!save) return;
    let cancelled = false;
    loadEngine()
      .then((engine) => {
        if (cancelled) return;
        table.current = engine.Table.restore(JSON.stringify(save.record), JSON.stringify(save.bots));
        seen.current = 0;
        setJournal([]);
        setStatus("ready");
        refresh();
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
    // La partie n'est ouverte qu'une fois par sauvegarde : `refresh` change
    // d'identité avec elle.
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
    (action: EngineAction) => {
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

  // Le coup suivant d'une IA, tout de suite : le pas à pas d'une partie en pause.
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

  return { status, error, update, journal, seat, away: [], act, hold: setHeld, step };
}
