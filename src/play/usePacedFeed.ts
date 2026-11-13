import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GameFeed } from "./game-feed";
import {
  ackAfter,
  CATCH_UP_LIMIT,
  DEFAULT_PACE,
  delayOf,
  diedIn,
  PACE_SPEEDS,
  placeOf,
  TABLE_VIEWS,
  type Ack,
  type PaceSettings,
  type Place,
} from "../engine/pacing";
import type { EngineObj, EngineTold, EngineUpdate } from "../engine/types";

const PACE_STORAGE_KEY = "joutes.play.pace";

function prefersLessMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readPace(): PaceSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PACE_STORAGE_KEY) ?? "null") as Partial<PaceSettings> | null;
    return {
      speed: raw?.speed && PACE_SPEEDS.includes(raw.speed) ? raw.speed : DEFAULT_PACE.speed,
      stops: typeof raw?.stops === "boolean" ? raw.stops : DEFAULT_PACE.stops,
      // Sans choix enregistré, la table reste à plat si le système demande moins d'animations.
      view: raw?.view && TABLE_VIEWS.includes(raw.view) ? raw.view : prefersLessMotion() ? "flat" : DEFAULT_PACE.view,
      camera: typeof raw?.camera === "boolean" ? raw.camera : DEFAULT_PACE.camera,
      watchStops: typeof raw?.watchStops === "boolean" ? raw.watchStops : DEFAULT_PACE.watchStops,
      effects: typeof raw?.effects === "boolean" ? raw.effects : !prefersLessMotion(),
      autoPay: typeof raw?.autoPay === "boolean" ? raw.autoPay : DEFAULT_PACE.autoPay,
    };
  } catch {
    return DEFAULT_PACE;
  }
}

function writePace(pace: PaceSettings): void {
  try {
    window.localStorage.setItem(PACE_STORAGE_KEY, JSON.stringify(pace));
  } catch {
    // Stockage refusé : le réglage vaut pour cette page seulement.
  }
}

/** Une mise à jour du moteur et les entrées du journal qu'elle a apportées : `[start, end)`. */
type Snapshot = { start: number; end: number; update: EngineUpdate };

/** Une unité qui vient de mourir, dessinée encore le temps de le raconter. */
export type Ghost = { obj: EngineObj; place: Place; dying: boolean };

export type PacedFeed = {
  /** La mise à jour à dessiner : celle de l'évènement raconté, sans question tant que le récit court. */
  update: EngineUpdate | null;
  /** Le récit déjà montré. */
  journal: EngineTold[];
  /** L'évènement au premier plan, et sa place dans le journal. */
  current: { entry: EngineTold; index: number; ms: number } | null;
  /** Les évènements pas encore racontés. */
  remaining: number;
  /** Le récit n'a pas rattrapé la partie : pas de question, et les robots attendent. */
  busy: boolean;
  ack: Ack | null;
  ghosts: Ghost[];
  proceed: () => void;
  skip: () => void;
  pace: PaceSettings;
  setPace: (pace: PaceSettings) => void;
  /** Le récit est en pause : rien n'avance, et les robots attendent. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /**
   * En pause : montre l'évènement suivant, ou fait jouer le coup suivant d'une
   * IA quand le récit a rattrapé la partie (`GameFeed.step`).
   */
  step: () => void;
};

/**
 * Raconte la partie pas à pas. Le moteur (ou le serveur) rend tout ce qui
 * s'est passé depuis la dernière question d'un seul bloc ; on le montre ici un
 * évènement à la fois, avec un délai selon son poids, et un arrêt
 * « Continuer » aux moments clés (`ackAfter`).
 */
export function usePacedFeed(feed: GameFeed): PacedFeed {
  const me = feed.seat;
  const journal = feed.journal;
  const [pace, setPaceState] = useState<PaceSettings>(DEFAULT_PACE);
  const [seen, setSeen] = useState<EngineUpdate | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  // `cursor` : entrées montrées ; `settled` : entrées dont le temps de lecture est passé.
  const [cursor, setCursor] = useState(0);
  const [settled, setSettled] = useState(0);
  const [ack, setAck] = useState<Ack | null>(null);
  // Quand l'évènement au premier plan est apparu : une mise à jour qui arrive
  // pendant sa lecture (en ligne) ne doit pas relancer son délai.
  const shownSince = useRef<{ index: number; at: number } | null>(null);
  const [paused, setPaused] = useState(false);
  // En pause, un pas demandé alors que tout était raconté : montrer le premier
  // évènement du coup joué dès qu'il arrive.
  const [stepWanted, setStepWanted] = useState(false);
  const stops = me === null ? pace.watchStops : pace.stops;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage après le montage, pour ne pas diverger du rendu serveur
    setPaceState(readPace());
  }, []);

  const setPace = useCallback((next: PaceSettings) => {
    setPaceState(next);
    writePace(next);
  }, []);

  // Chaque nouvelle mise à jour devient une étape du récit (état dérivé pendant
  // le rendu, sans effet : https://react.dev/learn/you-might-not-need-an-effect).
  if (feed.update !== seen) {
    setSeen(feed.update);
    if (feed.update) {
      const end = journal.length;
      const last = snapshots[snapshots.length - 1];
      const fresh = !last || end < cursor || end - cursor > CATCH_UP_LIMIT || pace.speed === "instant";
      if (fresh) {
        // Ouverture de la table, partie recommencée, gros retard : on part d'ici.
        setSnapshots([{ start: end, end, update: feed.update }]);
        setCursor(end);
        setSettled(end);
        setAck(null);
      } else {
        // Ne garder que ce qui reste à raconter, et l'état d'avant (pour les unités qui meurent).
        const firstKept = snapshots.findIndex((snapshot) => snapshot.end > settled);
        const kept = firstKept < 0 ? snapshots.slice(-1) : snapshots.slice(Math.max(0, firstKept - 1));
        setSnapshots([...kept, { start: last.end, end, update: feed.update }]);
      }
    }
  }

  const length = journal.length;
  const showing = cursor - 1;
  const snapshotIndex = snapshots.findIndex((snapshot) => snapshot.start <= showing && showing < snapshot.end);
  const inStep = settled < cursor;

  useEffect(() => {
    if (paused) {
      if (stepWanted && settled >= cursor && cursor < length) {
        const timer = window.setTimeout(() => {
          setStepWanted(false);
          setCursor(cursor + 1);
        }, 0);
        return () => window.clearTimeout(timer);
      }
      return;
    }
    if (ack) return;
    if (pace.speed === "instant" && (cursor < length || settled < length)) {
      const timer = window.setTimeout(() => {
        setCursor(length);
        setSettled(length);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (settled < cursor) {
      const entry = journal[cursor - 1];
      const snapshot = snapshots[snapshotIndex];
      const now = performance.now();
      if (shownSince.current?.index !== cursor) shownSince.current = { index: cursor, at: now };
      const wait = entry ? delayOf(entry, me, pace.speed) - (now - shownSince.current.at) : 0;
      const timer = window.setTimeout(
        () => {
          const next = stops && snapshot ? ackAfter(journal, cursor - 1, snapshot.start, snapshot.end, me) : null;
          if (next) setAck(next);
          else setSettled(cursor);
        },
        Math.max(0, wait),
      );
      return () => window.clearTimeout(timer);
    }
    if (cursor < length) {
      const timer = window.setTimeout(() => setCursor(cursor + 1), 0);
      return () => window.clearTimeout(timer);
    }
  }, [ack, cursor, settled, length, journal, snapshots, snapshotIndex, me, pace, stops, paused, stepWanted]);

  const proceed = useCallback(() => {
    setAck(null);
    setSettled(cursor);
  }, [cursor]);

  const skip = useCallback(() => {
    setAck(null);
    setCursor(length);
    setSettled(length);
  }, [length]);

  const feedStep = feed.step;
  const step = useCallback(() => {
    if (ack) {
      setAck(null);
      setSettled(cursor);
    } else if (settled < cursor) {
      // L'évènement montré est lu : passer au suivant, s'il y en a un.
      setSettled(cursor);
      if (cursor < length) setCursor(cursor + 1);
    } else if (cursor < length) {
      setCursor(cursor + 1);
    } else if (feedStep) {
      setStepWanted(true);
      feedStep();
    }
  }, [ack, cursor, settled, length, feedStep]);

  const busy = settled < length || ack !== null;
  const latest = snapshots[snapshots.length - 1]?.update ?? feed.update;
  const shown = snapshotIndex >= 0 ? snapshots[snapshotIndex] : null;

  const update = useMemo<EngineUpdate | null>(() => {
    if (!busy) return latest;
    const base = shown?.update ?? latest;
    return base ? { ...base, prompt: null } : null;
  }, [busy, latest, shown]);

  const ghosts = useMemo<Ghost[]>(() => {
    if (!shown || snapshotIndex < 1) return [];
    const before = snapshots[snapshotIndex - 1].update.view;
    const batch = journal.slice(shown.start, shown.end);
    const out: Ghost[] = [];
    for (const id of diedIn(batch)) {
      if (placeOf(shown.update.view, id)) continue;
      const was = placeOf(before, id);
      if (!was) continue;
      const diedAt =
        shown.start + batch.findIndex((entry) => entry.event.type === "died" && entry.event.unit === id);
      // Visible jusqu'à la fin de la lecture de sa mort ; grisée dès qu'elle est racontée.
      if (settled > diedAt) continue;
      out.push({ obj: was.obj, place: was.place, dying: showing >= diedAt });
    }
    return out;
  }, [shown, snapshotIndex, snapshots, journal, settled, showing]);

  const visibleJournal = useMemo(() => (cursor >= length ? journal : journal.slice(0, cursor)), [journal, cursor, length]);

  const currentEntry = inStep || ack ? journal[showing] : undefined;

  return {
    update,
    journal: visibleJournal,
    current: currentEntry ? { entry: currentEntry, index: showing, ms: delayOf(currentEntry, me, pace.speed) } : null,
    remaining: Math.max(0, length - cursor),
    busy,
    ack,
    ghosts,
    proceed,
    skip,
    pace,
    setPace,
    paused,
    setPaused,
    step,
  };
}
