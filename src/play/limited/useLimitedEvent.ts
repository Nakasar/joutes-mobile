import { useCallback, useEffect, useRef, useState } from "react";

import type { LimitedGame, LimitedRecord, LimitedView } from "../../engine/limited";
import type { LimitedHandle, LimitedProfile } from "../../engine/limited-profile";

/** Le temps entre deux choix des IA : assez pour voir la table avancer, sans faire attendre. */
const BOT_DELAY_MS = 110;

export type LimitedAction<D> =
  { type: "pick"; code: string; foil: boolean } | { type: "submit"; deck: D } | { type: "auto" } | { type: "forfeit" };

export type LimitedFeed<D, G> = {
  status: "loading" | "ready" | "error";
  error: string | null;
  view: LimitedView<D> | null;
  /** Mon siège. */
  seat: number;
  /** Joue une action ; rend le message du moteur s'il la refuse. */
  act: (action: LimitedAction<D>) => string | null;
  /** Les problèmes d'un deck, dans les mots du moteur. Vide s'il est légal. */
  check: (deck: D) => string[];
  /** Un deck construit par le moteur avec ma réserve, ou `null`. */
  suggest: () => D | null;
  /** La partie d'un match : configuration, graine, robots. */
  game: (index: number) => LimitedGame<G> | null;
  /** Inscrit le résultat d'un match (`null` : partie nulle). */
  report: (index: number, winner: number | null) => void;
};

const SEAT = 0;

/**
 * Un scellé ou un draft contre des IA, tenu entièrement dans le navigateur :
 * les boosters de tout le monde sont ouverts ici et ne quittent pas la page.
 * Le journal est réécrit à chaque avancée (`onRecord`) : recharger reprend.
 */
export function useLimitedEvent<D, G>(
  profile: LimitedProfile,
  save: { record: LimitedRecord } | null,
  onRecord: (record: LimitedRecord) => void,
): LimitedFeed<D, G> {
  const event = useRef<LimitedHandle | null>(null);
  const [status, setStatus] = useState<LimitedFeed<D, G>["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<LimitedView<D> | null>(null);
  const keep = useRef(onRecord);
  useEffect(() => {
    keep.current = onRecord;
  });

  // L'évènement n'est rouvert que pour une autre graine : la sauvegarde change
  // à chaque choix, l'évènement en mémoire reste le même.
  const seed = save?.record.seed;
  const opening = useRef(save);
  useEffect(() => {
    opening.current = save;
  });

  const refresh = useCallback((persist: boolean) => {
    const current = event.current;
    if (!current) return;
    try {
      setView(JSON.parse(current.view(SEAT)) as LimitedView<D>);
      if (persist) keep.current(JSON.parse(current.record()) as LimitedRecord);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    const record = opening.current?.record;
    if (seed === undefined || !record) return;
    let cancelled = false;
    profile
      .engine()
      .then((engine) => {
        if (cancelled) return;
        event.current = engine.restore(JSON.stringify(record));
        setStatus("ready");
        setError(null);
        refresh(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      cancelled = true;
      event.current?.free();
      event.current = null;
    };
  }, [seed, refresh, profile]);

  // Les IA choisissent une à une tant qu'il leur reste quelque chose à faire.
  const seq = view?.seq;
  const busy = view?.seats.some(
    (seat) => seat.bot && !seat.out && (view.phase === "draft" ? seat.waiting > 0 : view.phase === "build" && !seat.ready),
  );
  useEffect(() => {
    const current = event.current;
    if (!current || status !== "ready" || !busy) return;
    const timer = window.setTimeout(() => {
      if (event.current !== current) return;
      try {
        if (current.bot_step() >= 0) refresh(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [seq, busy, status, refresh]);

  const act = useCallback(
    (action: LimitedAction<D>): string | null => {
      const current = event.current;
      if (!current) return null;
      try {
        current.act(SEAT, JSON.stringify(action));
      } catch (cause) {
        return cause instanceof Error ? cause.message : String(cause);
      }
      refresh(true);
      return null;
    },
    [refresh],
  );

  const check = useCallback((deck: D): string[] => {
    const current = event.current;
    if (!current) return [];
    try {
      return JSON.parse(current.check(SEAT, JSON.stringify(deck))) as string[];
    } catch (cause) {
      return [cause instanceof Error ? cause.message : String(cause)];
    }
  }, []);

  const suggest = useCallback((): D | null => {
    const current = event.current;
    return current ? (JSON.parse(current.suggest(SEAT)) as D | null) : null;
  }, []);

  const game = useCallback((index: number): LimitedGame<G> | null => {
    const current = event.current;
    return current ? (JSON.parse(current.game(index)) as LimitedGame<G> | null) : null;
  }, []);

  const report = useCallback(
    (index: number, winner: number | null) => {
      const current = event.current;
      if (!current) return;
      try {
        current.report(index, winner ?? -1);
      } catch {
        // Déjà inscrit (page rechargée entre la fin de la partie et l'écriture) : rien à refaire.
      }
      refresh(true);
    },
    [refresh],
  );

  return { status, error, view, seat: SEAT, act, check, suggest, game, report };
}
