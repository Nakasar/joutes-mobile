import { useState } from "react";

import type { PlayGame, PlayResult } from "../api/play";
import { BOT_LEVELS, type BotLevel } from "../engine/types";
import { withDeckProblems } from "./DeckPicker";
import { usePlayT } from "./t";
import { shareLink, useToast } from "./ui";

type GuestSeat = { kind: "guest" | "bot"; name: string; deck: string; level: BotLevel };

type Invitation = { name: string; link: string; own: boolean; server: string; ticket: string };

/** Ce qu'un jeu fournit au mode hôte : `D` est la liste d'un deck telle que son moteur la veut. */
export type HostKit<D extends object> = {
  game: PlayGame;
  /** Le nombre de sièges en plus de celui de l'hôte. */
  seats: number;
  config: (players: { name: string; deck: D }[]) => unknown;
  auto: () => Promise<D | null>;
  resolve: (reference: string) => Promise<PlayResult<{ name: string; list: D }>>;
  needDeck: string;
};

const SERVER_STORAGE_KEY = "joutes.play.host.server";

function readServer(): string {
  try {
    return window.localStorage.getItem(SERVER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Mode hôte, comme sur le site (`components/play/HostPanel.tsx`) : la partie
 * tourne sur un serveur de parties lancé par quelqu'un (l'organisateur d'un
 * tournoi). L'app lui envoie la configuration, obtient un ticket par joueur et
 * donne un lien d'invitation à chacun, à partager ou à ouvrir ici. Joutes ne
 * voit ni l'adresse du serveur ni son code.
 */
export function HostPanel<D extends object>({
  hostName,
  hostDeck,
  kit,
  onOpen,
}: {
  hostName: string;
  hostDeck: () => Promise<D | null>;
  kit: HostKit<D>;
  /** Ouvre la partie de l'hôte dans l'app. */
  onOpen: (server: string, ticket: string) => void;
}) {
  const t = usePlayT("Play");
  const { toast, node } = useToast();
  const [server, setServer] = useState(readServer);
  const [token, setToken] = useState("");
  const [guests, setGuests] = useState<GuestSeat[]>([]);
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);

  const rows: GuestSeat[] = Array.from(
    { length: kit.seats },
    (_, index) => guests[index] ?? { kind: "guest", name: "", deck: "", level: "normal" },
  );
  const setRow = (index: number, patch: Partial<GuestSeat>) =>
    setGuests(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const create = async () => {
    setBusy(true);
    try {
      const base = server.trim().replace(/\/+$/, "");
      try {
        window.localStorage.setItem(SERVER_STORAGE_KEY, base);
      } catch {
        // Stockage refusé : l'adresse sera à ressaisir.
      }
      const auto = async (): Promise<D> => {
        const deck = await kit.auto();
        if (!deck) throw new Error(t("error.SERVER"));
        return deck;
      };

      const mine = await hostDeck();
      if (!mine) throw new Error(kit.needDeck);
      const players: { name: string; deck: D }[] = [{ name: hostName, deck: mine }];
      const bots: (BotLevel | null)[] = [null];
      for (const [index, row] of rows.entries()) {
        const name =
          row.name.trim() ||
          (row.kind === "bot" ? t("lobby.botName", { number: index + 1 }) : t("host.guestName", { number: index + 1 }));
        let deck: D;
        if (row.kind === "guest" && row.deck.trim()) {
          const resolved = await kit.resolve(row.deck.trim());
          if (!resolved.ok) {
            throw new Error(withDeckProblems(t, `${name} : ${t(`error.${resolved.error}`)}`, resolved.details));
          }
          deck = resolved.list;
        } else {
          deck = await auto();
        }
        players.push({ name, deck });
        bots.push(row.kind === "bot" ? row.level : null);
      }

      const headers = { "content-type": "application/json", authorization: `Bearer ${token.trim()}` };
      const created = await fetch(`${base}/games`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...(kit.game === "swu" ? { game: "swu" } : {}), config: kit.config(players), bots }),
      });
      const game = (await created.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!created.ok || !game?.id) throw new Error(game?.error ?? t("host.refused", { status: created.status }));

      const ticket = async (body: object): Promise<string> => {
        const response = await fetch(`${base}/games/${game.id}/tickets`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const json = (await response.json().catch(() => null)) as { ticket?: string; error?: string } | null;
        if (!response.ok || !json?.ticket) throw new Error(json?.error ?? t("host.refused", { status: response.status }));
        return json.ticket;
      };
      // Le lien du site : il s'ouvre dans un navigateur comme dans l'app (qui le reconnaît au scan).
      const linkOf = (value: string) =>
        `https://joutes.app/games/${kit.game}/play/remote#server=${encodeURIComponent(base)}&ticket=${encodeURIComponent(value)}`;

      const list: Invitation[] = [];
      for (const [seat, player] of players.entries()) {
        if (bots[seat]) continue;
        const value = await ticket({ role: "player", seat, name: player.name });
        list.push({ name: player.name, link: linkOf(value), own: seat === 0, server: base, ticket: value });
      }
      const spectator = await ticket({ role: "spectator", name: t("host.spectator") });
      list.push({ name: t("host.spectators"), link: linkOf(spectator), own: false, server: base, ticket: spectator });
      setInvitations(list);
    } catch (error) {
      // `fetch` échoue sans détail quand le serveur est injoignable.
      toast(error instanceof TypeError ? t("host.unreachable") : error instanceof Error ? error.message : String(error), "error");
    }
    setBusy(false);
  };

  if (invitations) {
    return (
      <div className="play-section">
        <p className="muted">{t("host.created")}</p>
        <div className="play-tables">
          {invitations.map((invitation) => (
            <div key={invitation.link} className="play-table-row">
              <b className="pt-grow">{invitation.name}</b>
              {invitation.own && (
                <button type="button" className="btn btn--grad btn--sm" onClick={() => onOpen(invitation.server, invitation.ticket)}>
                  {t("host.open")}
                </button>
              )}
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => void shareLink(invitation.link, invitation.name).then((how) => how === "copied" && toast(t("room.copied")))}
              >
                {t("room.share")}
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => setInvitations(null)}>
          {t("host.another")}
        </button>
        {node}
      </div>
    );
  }

  return (
    <div className="play-section">
      <p className="muted">{t("host.intro")}</p>
      <label className="field">
        <span className="field__label">{t("host.server")}</span>
        <input
          value={server}
          placeholder="https://parties.exemple.fr"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => setServer(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">{t("host.token")}</span>
        <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
      </label>

      {rows.map((row, index) => (
        <div key={index} className="play-seat play-seat--column">
          <div className="pt-row-wrap">
            <b className="pt-grow">{t("host.seat", { number: index + 2 })}</b>
            <div className="play-levels">
              <button
                type="button"
                className={`play-level${row.kind === "guest" ? " play-level--active" : ""}`}
                aria-pressed={row.kind === "guest"}
                onClick={() => setRow(index, { kind: "guest" })}
              >
                {t("host.guest")}
              </button>
              <button
                type="button"
                className={`play-level${row.kind === "bot" ? " play-level--active" : ""}`}
                aria-pressed={row.kind === "bot"}
                onClick={() => setRow(index, { kind: "bot" })}
              >
                {t("lobby.ai")}
              </button>
            </div>
          </div>
          {row.kind === "guest" ? (
            <>
              <input
                className="play-input"
                aria-label={t("host.guestNameLabel")}
                placeholder={t("host.guestNameLabel")}
                value={row.name}
                onChange={(event) => setRow(index, { name: event.target.value })}
              />
              <input
                className="play-input"
                aria-label={t("host.guestDeck")}
                placeholder={t("host.guestDeck")}
                value={row.deck}
                autoCapitalize="off"
                onChange={(event) => setRow(index, { deck: event.target.value })}
              />
            </>
          ) : (
            <div className="play-levels">
              {BOT_LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`play-level${row.level === value ? " play-level--active" : ""}`}
                  aria-pressed={row.level === value}
                  onClick={() => setRow(index, { level: value })}
                >
                  {t(`level.${value}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <button type="button" className="btn btn--grad btn--block" disabled={busy || !server.trim() || !token.trim()} onClick={create}>
        {t("host.create")}
      </button>
      <p className="muted play-small">{t("host.tls")}</p>
      {node}
    </div>
  );
}
