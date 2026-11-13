import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";

import {
  addBot,
  isPlayGame,
  joinTable,
  leaveSeat,
  loadLobby,
  readTable,
  searchPlayDecks,
  startTable,
  type DeckChoice,
  type LobbyDeck,
  type PlayGame,
  type PlayResult,
  type RiftboundLobby,
  type SwuLobby,
  type TableState,
} from "../api/play";
import { BackHeader } from "../components/BackHeader";
import { ASPECT_HEX, swuPickerCards } from "../engine/swu/cards";
import { DOMAIN_HEX } from "../engine/told-text";
import { BOT_LEVELS } from "../engine/types";
import { DeckPicker } from "./DeckPicker";
import { BotIcon, CloseIcon, UserIcon } from "./icons";
import { remoteSocketUrl } from "./remote";
import { RiftboundTable } from "./RiftboundTable";
import { SwuTable } from "./swu/SwuTable";
import { useSwuOnlineGame } from "./swu/useSwuOnlineGame";
import { readSwuSave, useSwuSoloGame, writeSwuSave, type SwuSave } from "./swu/useSwuSoloGame";
import { useSwuTableCards } from "./swu/useSwuTableCards";
import { usePlayT } from "./t";
import { shareLink, useToast } from "./ui";
import { useOnlineGame } from "./useOnlineGame";
import { readSoloSave, useSoloGame, writeSoloSave, type SoloSave } from "./useSoloGame";
import { useTableCards } from "./useTableCards";

const HANDS_STORAGE_KEY = "joutes.play.hands";

function readHands(): boolean {
  try {
    return window.localStorage.getItem(HANDS_STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function writeHands(hands: boolean): void {
  try {
    window.localStorage.setItem(HANDS_STORAGE_KEY, hands ? "shown" : "hidden");
  } catch {
    // Stockage refusé : le réglage vaut pour cette partie.
  }
}

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

/** Un écran sombre centré, quand il n'y a pas (encore) de table à montrer. */
function TableMessage({ children }: { children: ReactNode }) {
  return <div className="pt pt-wait">{children}</div>;
}

function useGameParam(): PlayGame | null {
  const { gameSlug } = useParams();
  return isPlayGame(gameSlug) ? gameSlug : null;
}

// ---------------------------------------------------------------------------
// Contre l'IA, ou IA contre IA : `/play/:gameSlug/solo`.

export function SoloGameScreen() {
  const game = useGameParam();
  if (!game) return <Navigate to="/play?section=table" replace />;
  return game === "swu" ? <SwuSolo /> : <RiftboundSolo />;
}

function RiftboundSolo() {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const cards = useTableCards();
  const [save, setSave] = useState<SoloSave | null>(readSoloSave);
  const [hands, setHands] = useState(readHands);
  const feed = useSoloGame(save, { hands });
  const home = "/play/riftbound";

  if (!save) {
    return (
      <TableMessage>
        <p className="pt-muted">{t("solo.none")}</p>
        <button type="button" className="pt-btn pt-btn--grad" onClick={() => navigate(home, { replace: true })}>
          {t("solo.toLobby")}
        </button>
      </TableMessage>
    );
  }

  const replay = () => {
    // Même configuration, nouvelle graine : une autre partie avec les mêmes decks.
    const next: SoloSave = { ...save, record: { ...save.record, seed: newSeed(), actions: [] } };
    writeSoloSave(next);
    setSave(next);
  };
  const after = (
    <div className="pt-row-wrap">
      <button type="button" className="pt-btn pt-btn--grad" onClick={replay}>
        {t("result.replay")}
      </button>
      <button
        type="button"
        className="pt-btn"
        onClick={() => {
          writeSoloSave(null);
          navigate(home, { replace: true });
        }}
      >
        {t("result.toLobby")}
      </button>
    </div>
  );

  // Une partie gardée que le moteur ne sait plus rouvrir (il a changé depuis).
  if (feed.status === "error" && !feed.update) {
    return (
      <TableMessage>
        <p className="pt-muted">{t("solo.broken")}</p>
        {after}
      </TableMessage>
    );
  }

  return (
    <RiftboundTable
      key={`${save.record.seed}`}
      feed={feed}
      cards={cards}
      home={home}
      watch={
        save.seat === null
          ? {
              hands,
              onHands: (next) => {
                setHands(next);
                writeHands(next);
              },
            }
          : undefined
      }
      afterResult={after}
    />
  );
}

function SwuSolo() {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const cards = useSwuTableCards();
  const [save, setSave] = useState<SwuSave | null>(readSwuSave);
  const feed = useSwuSoloGame(save, cards);
  const home = "/play/swu";

  if (!save) {
    return (
      <TableMessage>
        <p className="pt-muted">{t("solo.none")}</p>
        <button type="button" className="pt-btn pt-btn--grad" onClick={() => navigate(home, { replace: true })}>
          {t("solo.toLobby")}
        </button>
      </TableMessage>
    );
  }

  const replay = () => {
    const next: SwuSave = { ...save, record: { ...save.record, seed: newSeed(), actions: [] } };
    writeSwuSave(next);
    setSave(next);
  };
  const after = (
    <div className="pt-row-wrap pt-row-wrap--center">
      <button type="button" className="pt-btn pt-btn--grad" onClick={replay}>
        {t("result.replay")}
      </button>
      <button
        type="button"
        className="pt-btn"
        onClick={() => {
          writeSwuSave(null);
          navigate(home, { replace: true });
        }}
      >
        {t("result.toLobby")}
      </button>
    </div>
  );

  if (feed.status === "error" && !feed.update) {
    return (
      <TableMessage>
        <p className="pt-muted">{t("solo.broken")}</p>
        {after}
      </TableMessage>
    );
  }

  return <SwuTable key={`${save.record.seed}`} feed={feed} cards={cards} home={home} afterResult={after} />;
}

// ---------------------------------------------------------------------------
// Une partie hébergée (mode hôte) : `/play/:gameSlug/remote?server=&ticket=`.

export function RemoteGameScreen() {
  const game = useGameParam();
  const [params] = useSearchParams();
  const server = params.get("server");
  const ticket = params.get("ticket");
  const url = server && ticket ? remoteSocketUrl(server, ticket) : null;
  if (!game) return <Navigate to="/play?section=table" replace />;
  return game === "swu" ? <SwuRemote url={url} /> : <RiftboundRemote url={url} />;
}

function RemoteFailure({ home, bad }: { home: string; bad: boolean }) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  return (
    <TableMessage>
      <p>{bad ? t("remote.badLink") : t("remote.unreachable")}</p>
      {!bad && <p className="pt-muted pt-small">{t("remote.unreachableHint")}</p>}
      <button type="button" className="pt-btn pt-btn--grad" onClick={() => navigate(home, { replace: true })}>
        {t("solo.toLobby")}
      </button>
    </TableMessage>
  );
}

function RiftboundRemote({ url }: { url: string | null }) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const cards = useTableCards();
  const feed = useOnlineGame(url);
  const home = "/play/riftbound";
  if (!url) return <RemoteFailure home={home} bad />;
  if (feed.status === "error" && !feed.update) return <RemoteFailure home={home} bad={false} />;
  return (
    <RiftboundTable
      feed={feed}
      cards={cards}
      home={home}
      // Les noms et le récit de cette table viennent de ce serveur, pas de Joutes : on dit lequel.
      note={t("remote.server", { host: new URL(url).host })}
      afterResult={
        <button type="button" className="pt-btn" onClick={() => navigate(home, { replace: true })}>
          {t("result.toLobby")}
        </button>
      }
    />
  );
}

function SwuRemote({ url }: { url: string | null }) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const cards = useSwuTableCards();
  const feed = useSwuOnlineGame(url, cards);
  const home = "/play/swu";
  if (!url) return <RemoteFailure home={home} bad />;
  if (feed.status === "error" && !feed.update) return <RemoteFailure home={home} bad={false} />;
  return (
    <SwuTable
      feed={feed}
      cards={cards}
      home={home}
      note={t("remote.server", { host: new URL(url).host })}
      afterResult={
        <button type="button" className="pt-btn" onClick={() => navigate(home, { replace: true })}>
          {t("result.toLobby")}
        </button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Une table en ligne : `/play/:gameSlug/tables/:tableId`. La salle d'attente,
// puis la partie sur le serveur de parties.

const POLL_MS = 3000;

/** Le lien d'une table, celui du site : il s'ouvre aussi dans un navigateur, et l'app le reconnaît au scan. */
export function tableLink(game: PlayGame, id: string): string {
  return `https://joutes.app/games/${game}/play/table?id=${id}`;
}

export function TableRoomScreen() {
  const game = useGameParam();
  const { tableId = "" } = useParams();
  if (!game) return <Navigate to="/play?section=table" replace />;
  return <TableRoom key={`${game}:${tableId}`} game={game} id={tableId.toLowerCase()} />;
}

function TableRoom({ game, id }: { game: PlayGame; id: string }) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const home = `/play/${game}`;
  const [state, setState] = useState<TableState | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [choice, setChoice] = useState<DeckChoice | null>(null);
  const [busy, setBusy] = useState(false);
  // L'adresse d'une partie est gardée telle qu'elle a été reçue la première
  // fois : chaque lecture signe un nouveau ticket, et changer d'adresse
  // couperait la connexion pour rien.
  const [socket, setSocket] = useState<{ game: string; url: string } | null>(null);
  const [silent, setSilent] = useState(true);
  const [qr, setQr] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<TableState | null> => {
    const result = await readTable(game, id);
    if (!result.ok) {
      setFailure(result.error);
      return null;
    }
    const { access } = result.state;
    setFailure(null);
    setState(result.state);
    setSocket((previous) =>
      access ? (previous?.game === access.game ? previous : { game: access.game, url: access.ws }) : null,
    );
    return result.state;
  }, [game, id]);

  const renew = useCallback(async () => (await refresh())?.access?.ws ?? null, [refresh]);

  const status = state?.table.status;
  const polling = status === "waiting" || (status === "playing" && silent);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, refresh]);

  const link = tableLink(game, id);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(link, { margin: 1, width: 320 }).then((data: string) => {
      if (!cancelled) setQr(data);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  const run = async (action: () => Promise<PlayResult>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast(
        result.details?.length ? `${t(`error.${result.error}`)} ${result.details.join(" ")}` : t(`error.${result.error}`),
        "error",
      );
    }
    await refresh();
  };

  const toLobby = (
    <button type="button" className="pt-btn pt-btn--grad" onClick={() => navigate(home, { replace: true })}>
      {t("solo.toLobby")}
    </button>
  );

  if (failure) {
    return (
      <div className="screen">
        <BackHeader title={t("lobby.online")} />
        <div className="pt-wait">
          <p className="muted">{t(`error.${failure}`)}</p>
          <Link to={home} className="btn btn--grad">
            {t("solo.toLobby")}
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="screen">
        <BackHeader title={t("lobby.online")} />
        <p className="pt-wait muted">{t("status.loading")}</p>
      </div>
    );
  }

  const { table } = state;

  if (table.status === "cancelled") {
    return (
      <div className="screen">
        <BackHeader title={t("lobby.online")} />
        <div className="pt-wait">
          <p className="muted">{t("room.cancelled")}</p>
          <Link to={home} className="btn btn--grad">
            {t("solo.toLobby")}
          </Link>
        </div>
      </div>
    );
  }

  if (table.status !== "waiting") {
    const unreachable = (
      <TableMessage>
        {table.status === "finished" && table.result ? (
          <>
            <p className="pt-prompt__title">
              {table.result.winners.length === 0
                ? t("result.draw")
                : t("result.winner", { names: table.result.winners.map((seat) => table.seats[seat]?.name ?? "?").join(", ") })}
            </p>
            <p className="pt-muted pt-small">{table.result.reason}</p>
          </>
        ) : (
          <>
            <p>{t("remote.unreachable")}</p>
            <p className="pt-muted pt-small">{t("room.unreachableHint")}</p>
          </>
        )}
        {toLobby}
      </TableMessage>
    );
    const after = (
      <button type="button" className="pt-btn" onClick={() => navigate(home, { replace: true })}>
        {t("result.toLobby")}
      </button>
    );
    const props = {
      url: socket?.url ?? null,
      renew,
      onSilent: setSilent,
      unreachable,
      afterResult: after,
      home,
    };
    // Une clé par partie : une table relancée repart d'un récit vide.
    return game === "swu" ? (
      <SwuOnlineTable key={socket?.game ?? "none"} {...props} />
    ) : (
      <RiftboundOnlineTable key={socket?.game ?? "none"} {...props} />
    );
  }

  const free = table.players - table.seats.length;

  return (
    <div className="screen play-screen">
      <BackHeader title={t("room.title", { mode: game === "swu" ? "Star Wars: Unlimited" : t(`mode.${table.mode}`) })} />
      <div className="play-split">
        <section className="play-section play-room-invite">
          <div className="pt-row-wrap">
            <span className="muted">{t("room.codeLabel")}</span>
            <span className="play-code">{table.id}</span>
          </div>
          {qr && (
            <div className="play-qr">
              <img src={qr} alt={t("room.qr")} />
            </div>
          )}
          <p className="muted play-small">{t("room.invite")}</p>
          <button
            type="button"
            className="btn btn--outline btn--block"
            onClick={() => void shareLink(link, t("room.title", { mode: t(`mode.${table.mode}`) })).then((how) => how === "copied" && toast(t("room.copied")))}
          >
            {t("room.share")}
          </button>
        </section>

        <div className="play-screen">
          <section className="play-section">
            <h2 className="play-section__title">{t("room.seats", { taken: table.seats.length, total: table.players })}</h2>
            {table.seats.map((seat, index) => (
              <div key={index} className="play-seat">
                <span className="play-seat__icon">{seat.bot ? <BotIcon size={18} /> : <UserIcon size={18} />}</span>
                <div className="play-seat__body">
                  <span className="play-seat__name">
                    {seat.name}
                    {seat.host && <span className="chip play-you">{t("room.host")}</span>}
                  </span>
                  <span className="play-deck__sub">
                    {seat.bot ? t("room.botSeat", { level: t(`level.${seat.bot}`) }) : seat.deckName}
                  </span>
                </div>
                {(state.isHost || state.seat === index) && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await leaveSeat(game, table.id, index, seat.name);
                        if (result.ok && state.seat === index && state.isHost) navigate(home, { replace: true });
                        return result;
                      })
                    }
                  >
                    <CloseIcon size={14} />
                    {state.seat === index ? (state.isHost ? t("room.cancel") : t("room.leave")) : t("room.remove")}
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: free }, (_, index) => (
              <div key={`free-${index}`} className="play-seat play-seat--free">
                {t("room.freeSeat")}
              </div>
            ))}

            {state.isHost && (
              <>
                {free > 0 && (
                  <div className="pt-row-wrap">
                    {BOT_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={busy}
                        onClick={() => void run(() => addBot(game, table.id, level))}
                      >
                        <BotIcon size={14} />
                        {t("room.addBot", { level: t(`level.${level}`) })}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn--grad btn--block"
                  disabled={busy || free > 0}
                  onClick={() => void run(() => startTable(game, table.id))}
                >
                  {free > 0 ? t("room.waitingPlayers", { count: free }) : t("room.start")}
                </button>
              </>
            )}
            {!state.isHost && state.seat !== null && <p className="muted play-small">{t("room.waitingHost")}</p>}
          </section>

          {state.seat === null && free > 0 && (
            <section className="play-section">
              <h2 className="play-section__title">{t("room.join")}</h2>
              {!state.signedIn ? (
                <div className="pt-row-wrap">
                  <span className="muted">{t("room.signIn")}</span>
                  <Link to="/login" className="btn btn--outline btn--sm">
                    {t("lobby.signIn")}
                  </Link>
                </div>
              ) : (
                <>
                  <JoinPicker game={game} value={choice} onChange={setChoice} />
                  <button
                    type="button"
                    className="btn btn--grad btn--block"
                    disabled={busy || !choice}
                    onClick={() => void run(() => joinTable(game, table.id, choice))}
                  >
                    {t("room.sit")}
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      </div>
      {node}
    </div>
  );
}

/** Le deck de la personne qui s'assoit : les decks de la page Jouer, chargés à la demande. */
function JoinPicker({ game, value, onChange }: { game: PlayGame; value: DeckChoice | null; onChange: (choice: DeckChoice) => void }) {
  return game === "swu" ? <SwuJoinPicker value={value} onChange={onChange} /> : <RiftboundJoinPicker value={value} onChange={onChange} />;
}

function useLobbyOnce<T>(game: PlayGame): T | null {
  const [lobby, setLobby] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadLobby(game).then((result) => {
      if (!cancelled && result.ok) setLobby(result.lobby as T);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);
  return lobby;
}

const searchRiftbound = (query: string) => searchPlayDecks<LobbyDeck<unknown>>("riftbound", query);
const searchSwu = (query: string) => searchPlayDecks<LobbyDeck<unknown>>("swu", query);

function RiftboundJoinPicker({ value, onChange }: { value: DeckChoice | null; onChange: (choice: DeckChoice) => void }) {
  const t = usePlayT("Play");
  const cards = useTableCards();
  const lobby = useLobbyOnce<RiftboundLobby>("riftbound");
  return (
    <DeckPicker
      title={t("deck.label")}
      decks={(lobby?.decks ?? []) as LobbyDeck<unknown>[]}
      legends={lobby?.legends ?? []}
      cards={cards}
      colors={DOMAIN_HEX}
      search={searchRiftbound}
      value={value}
      onChange={(next) => {
        if (next.kind !== "random") onChange(next);
      }}
    />
  );
}

function SwuJoinPicker({ value, onChange }: { value: DeckChoice | null; onChange: (choice: DeckChoice) => void }) {
  const t = usePlayT("Play");
  const ts = usePlayT("PlaySwu");
  const cards = useSwuTableCards();
  const lobby = useLobbyOnce<SwuLobby>("swu");
  return (
    <DeckPicker
      title={t("deck.label")}
      decks={(lobby?.decks ?? []) as LobbyDeck<unknown>[]}
      legends={lobby?.leaders ?? []}
      cards={swuPickerCards(cards)}
      colors={ASPECT_HEX}
      texts={{ auto: ts("lobby.deckAuto"), randomHint: ts("lobby.deckRandomHint"), search: ts("lobby.deckSearch") }}
      search={searchSwu}
      value={value}
      onChange={(next) => {
        if (next.kind !== "random") onChange(next);
      }}
    />
  );
}

type OnlineTableProps = {
  url: string | null;
  renew: () => Promise<string | null>;
  onSilent: (silent: boolean) => void;
  unreachable: ReactNode;
  afterResult: ReactNode;
  home: string;
};

function RiftboundOnlineTable({ url, renew, onSilent, unreachable, afterResult, home }: OnlineTableProps) {
  const cards = useTableCards();
  const feed = useOnlineGame(url, renew);
  const silent = !feed.update;
  useEffect(() => {
    onSilent(silent);
  }, [silent, onSilent]);
  if (feed.status === "error" && !feed.update) return <>{unreachable}</>;
  return <RiftboundTable feed={feed} cards={cards} home={home} afterResult={afterResult} />;
}

function SwuOnlineTable({ url, renew, onSilent, unreachable, afterResult, home }: OnlineTableProps) {
  const cards = useSwuTableCards();
  const feed = useSwuOnlineGame(url, cards, renew);
  const silent = !feed.update;
  useEffect(() => {
    onSilent(silent);
  }, [silent, onSilent]);
  if (feed.status === "error" && !feed.update) return <>{unreachable}</>;
  return <SwuTable feed={feed} cards={cards} home={home} afterResult={afterResult} />;
}
