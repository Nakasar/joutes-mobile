import { useCallback, useEffect, useRef, useState } from "react";

type ServerMessage<U> =
  | { type: "welcome"; game: string; role: string; seat: number | null; name: string }
  | ({ type: "update" } & U)
  | { type: "presence"; seat: number; connected: boolean }
  | { type: "error"; message: string }
  | { type: "pong" };

const PING_MS = 25_000;
const MAX_RETRY_MS = 15_000;
/** Après autant d'échecs de suite, le ticket est peut-être périmé : on en demande un autre. */
const RENEW_AFTER = 3;

export type GameSocket = {
  status: "loading" | "ready" | "reconnecting" | "error";
  /** Message du serveur, tel quel. */
  error: string | null;
  /** Mon siège, ou `null` pour un spectateur. */
  seat: number | null;
  /** Sièges dont le joueur est déconnecté. */
  away: number[];
  act: (action: unknown) => void;
};

/**
 * La connexion à une partie sur un serveur de parties, quel que soit le jeu.
 * `url` est l'adresse WebSocket complète, ticket compris. La connexion se
 * rétablit seule : le serveur renvoie alors les évènements manqués depuis le
 * dernier vu (`since`).
 *
 * `onUpdate` reçoit chaque mise à jour, avec le numéro du dernier évènement
 * déjà vu ; `fresh` est faux pour un message en retard (course entre deux
 * envois), dont les évènements ne doivent pas doubler le récit.
 *
 * `renew` rend une adresse fraîche (nouveau ticket) quand la connexion ne
 * revient pas, ou `null` si la partie n'est plus joignable : un onglet resté
 * ouvert plus longtemps que son ticket ne réessaie pas sans fin pour rien.
 */
export function useGameSocket<U extends { seq: number }>(
  url: string | null,
  onUpdate: (update: U, seen: number, fresh: boolean) => void,
  renew?: () => Promise<string | null>,
): GameSocket {
  const renewRef = useRef(renew);
  const updateRef = useRef(onUpdate);
  useEffect(() => {
    renewRef.current = renew;
    updateRef.current = onUpdate;
  }, [renew, onUpdate]);

  const socket = useRef<WebSocket | null>(null);
  const seen = useRef(0);
  const [status, setStatus] = useState<GameSocket["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [away, setAway] = useState<number[]>([]);
  useEffect(() => {
    if (!url) return;
    let closed = false;
    let retry = 0;
    let welcomed = false;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    let address = url;

    const connect = () => {
      const separator = address.includes("?") ? "&" : "?";
      const ws = new WebSocket(`${address}${separator}since=${seen.current}`);
      socket.current = ws;

      ws.onopen = () => {
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, PING_MS);
      };

      ws.onmessage = (event) => {
        let message: ServerMessage<U>;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage<U>;
        } catch {
          return;
        }
        if (message.type === "welcome") {
          welcomed = true;
          retry = 0;
          setSeat(message.seat);
          setStatus("ready");
          setError(null);
        } else if (message.type === "update") {
          const previous = seen.current;
          const fresh = message.seq > previous;
          if (fresh) seen.current = message.seq;
          updateRef.current(message, previous, fresh);
        } else if (message.type === "presence") {
          setAway((previous) =>
            message.connected
              ? previous.filter((value) => value !== message.seat)
              : previous.includes(message.seat)
                ? previous
                : [...previous, message.seat],
          );
        } else if (message.type === "error") {
          setError(message.message);
        }
      };

      ws.onclose = () => {
        window.clearInterval(pingTimer);
        if (closed) return;
        // Un ticket refusé l'est avant l'ouverture : le navigateur ne voit
        // qu'une connexion qui échoue, sans la raison.
        setStatus((previous) => (previous === "ready" || previous === "reconnecting" ? "reconnecting" : previous));
        retry += 1;
        // Jamais entré après plusieurs essais : ticket refusé ou serveur
        // injoignable. Le navigateur ne dit pas lequel.
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

  const act = useCallback((action: unknown) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) {
      setError(null);
      ws.send(JSON.stringify({ type: "act", action }));
    }
  }, []);

  return { status, error, seat, away, act };
}
