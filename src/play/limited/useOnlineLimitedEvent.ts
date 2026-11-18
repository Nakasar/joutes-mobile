import { useCallback, useEffect, useRef, useState } from "react";

import type { LimitedAction } from "./useLimitedEvent";
import type { LimitedView } from "../../engine/limited";

/** La table d'un match, telle que le serveur la donne au joueur qui y est assis. */
export type MatchSeat = { index: number; game: string; seat: number; ticket: string };

type ServerMessage<D> =
  | { type: "welcome"; event: string; role: string; seat: number | null; name: string }
  | { type: "presence"; seat: number; connected: boolean }
  | {
      type: "event";
      view: LimitedView<D>;
      /** Secondes qu'il me reste pour choisir ou construire ; `null` sans délai. */
      due: number | null;
      timers: { pick: number; build: number };
      table: MatchSeat | null;
    }
  | { type: "checked"; problems: string[] }
  | { type: "suggested"; deck: D | null }
  | { type: "error"; message: string }
  | { type: "pong" };

const PING_MS = 25_000;
const MAX_RETRY_MS = 15_000;
const RENEW_AFTER = 3;

export type OnlineLimitedFeed<D> = {
  status: "loading" | "ready" | "reconnecting" | "error";
  /** Le dernier refus du serveur, numéroté pour qu'un même message reparaisse. */
  error: { id: number; message: string } | null;
  view: LimitedView<D> | null;
  /** Mon siège, ou `null` pour un spectateur. */
  seat: number | null;
  /** L'instant (horloge du navigateur) où mon délai s'achève, ou `null`. */
  deadline: number | null;
  /** La table de mon match, pendant les matchs. */
  table: MatchSeat | null;
  /** Sièges dont le joueur est déconnecté. */
  away: number[];
  /** Les problèmes du dernier deck vérifié, avec ce deck (sérialisé) ; `null` tant que rien n'est revenu. */
  checked: { deck: string; problems: string[] } | null;
  act: (action: LimitedAction<D>) => void;
  /** Demande au serveur de vérifier ce deck : la réponse arrive dans `checked`. */
  check: (deck: D) => void;
  /** Un deck construit par le serveur avec ma réserve, ou `null`. */
  suggest: () => Promise<D | null>;
};

/**
 * Un scellé ou un draft sur un serveur de parties : le serveur ouvre les
 * boosters et n'envoie à chacun que les siens. `url` est l'adresse WebSocket
 * complète, ticket compris. La connexion se rétablit seule : le serveur renvoie
 * alors l'état entier. `renew` rend une adresse fraîche quand elle ne revient pas.
 */
export function useOnlineLimitedEvent<D>(url: string | null, renew?: () => Promise<string | null>): OnlineLimitedFeed<D> {
  const renewRef = useRef(renew);
  useEffect(() => {
    renewRef.current = renew;
  }, [renew]);

  const socket = useRef<WebSocket | null>(null);
  const asked = useRef<string[]>([]);
  const waiting = useRef<((deck: D | null) => void)[]>([]);
  const errors = useRef(0);
  const [status, setStatus] = useState<OnlineLimitedFeed<D>["status"]>("loading");
  const [error, setError] = useState<OnlineLimitedFeed<D>["error"]>(null);
  const [view, setView] = useState<LimitedView<D> | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [table, setTable] = useState<MatchSeat | null>(null);
  const [away, setAway] = useState<number[]>([]);
  const [checked, setChecked] = useState<OnlineLimitedFeed<D>["checked"]>(null);

  useEffect(() => {
    if (!url) return;
    let closed = false;
    let retry = 0;
    let welcomed = false;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let address = url;

    const connect = () => {
      const ws = new WebSocket(address);
      socket.current = ws;
      // Les demandes parties sur l'ancienne connexion n'auront pas de réponse.
      asked.current = [];
      for (const resolve of waiting.current.splice(0)) resolve(null);

      ws.onopen = () => {
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, PING_MS);
      };

      ws.onmessage = (event) => {
        let message: ServerMessage<D>;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage<D>;
        } catch {
          return;
        }
        if (message.type === "welcome") {
          welcomed = true;
          retry = 0;
          setSeat(message.seat);
          setStatus("ready");
        } else if (message.type === "event") {
          setView(message.view);
          setDeadline(message.due === null ? null : Date.now() + message.due * 1000);
          setTable((previous) =>
            message.table && previous?.game === message.table.game && previous.seat === message.table.seat
              ? previous
              : message.table,
          );
        } else if (message.type === "presence") {
          setAway((previous) =>
            message.connected
              ? previous.filter((value) => value !== message.seat)
              : previous.includes(message.seat)
                ? previous
                : [...previous, message.seat],
          );
        } else if (message.type === "checked") {
          // Les réponses reviennent dans l'ordre des demandes.
          const deck = asked.current.shift();
          if (deck !== undefined) setChecked({ deck, problems: message.problems });
        } else if (message.type === "suggested") {
          waiting.current.shift()?.(message.deck);
        } else if (message.type === "error") {
          errors.current += 1;
          setError({ id: errors.current, message: message.message });
        }
      };

      ws.onclose = () => {
        window.clearInterval(pingTimer);
        if (closed) return;
        setStatus((previous) => (previous === "ready" || previous === "reconnecting" ? "reconnecting" : previous));
        retry += 1;
        // Jamais entré après plusieurs essais : ticket refusé ou serveur injoignable.
        if (retry > 3 && !welcomed) {
          setStatus("error");
          return;
        }
        const delay = Math.min(MAX_RETRY_MS, 500 * 2 ** Math.min(retry, 5));
        const again = renewRef.current;
        if (welcomed && again && retry % RENEW_AFTER === 0) {
          retryTimer = window.setTimeout(() => {
            void again().then((fresh) => {
              if (closed) return;
              if (!fresh) {
                setStatus("error");
                return;
              }
              address = fresh;
              connect();
            });
          }, delay);
          return;
        }
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      socket.current?.close();
      socket.current = null;
    };
  }, [url]);

  const send = useCallback((message: object): boolean => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  const act = useCallback((action: LimitedAction<D>) => void send({ type: "act", action }), [send]);

  const check = useCallback(
    (deck: D) => {
      if (send({ type: "check", deck })) asked.current.push(JSON.stringify(deck));
    },
    [send],
  );

  const suggest = useCallback(
    () =>
      new Promise<D | null>((resolve) => {
        if (send({ type: "suggest" })) waiting.current.push(resolve);
        else resolve(null);
      }),
    [send],
  );

  return { status, error, view, seat, deadline, table, away, checked, act, check, suggest };
}
