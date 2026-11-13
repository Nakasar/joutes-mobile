import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import {
  createTable,
  isPlayGame,
  loadLobby,
  resolveDeck,
  searchPlayDecks,
  type BotDeckChoice,
  type DeckChoice,
  type GameTableSummary,
  type LobbyDeck,
  type PlayGame,
  type RiftboundLobby,
  type SwuLobby,
  type SwuLobbyDeck,
} from "../api/play";
import { BackHeader } from "../components/BackHeader";
import { loadEngine } from "../engine/browser";
import { loadSwuEngine } from "../engine/swu/browser";
import { ASPECT_HEX, swuPickerCards, type SwuTableCards } from "../engine/swu/cards";
import type { SwuDeckList } from "../engine/swu/types";
import { DOMAIN_HEX } from "../engine/told-text";
import { BOT_LEVELS, ENGINE_MODES, modePlayers, type BotLevel, type EngineDeckList, type EngineMode } from "../engine/types";
import { DeckPicker, withDeckProblems } from "./DeckPicker";
import { HostPanel, type HostKit } from "./HostPanel";
import { BotIcon, EyeIcon, GlobeIcon, ServerIcon } from "./icons";
import { readSwuSave, writeSwuSave, type SwuSave } from "./swu/useSwuSoloGame";
import { useSwuTableCards } from "./swu/useSwuTableCards";
import { usePlayT } from "./t";
import { Toggle, useToast } from "./ui";
import { readSoloSave, writeSoloSave, type SoloSave } from "./useSoloGame";
import { useTableCards } from "./useTableCards";
import { remotePath } from "./remote";

/** Qui joue : moi contre l'IA, des IA entre elles (je regarde), en ligne, ou sur un serveur. */
type Opponent = "ai" | "watch" | "online" | "host";

/** Couleurs des sièges, dans l'ordre de la table. */
const SEAT_COLORS = ["#2bb7dc", "#f05a7e", "#f5b041", "#8e7cf0"];

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

type PickerCards = Record<string, { name: string; image?: string; domains?: string[] } | undefined>;

/** Ce que chaque jeu apporte à la page : ses modes, ses decks automatiques, sa partie contre l'IA. */
type LobbyKit<L extends object> = {
  game: PlayGame;
  lobby: RiftboundLobby | SwuLobby;
  /** Les modes de jeu (Riftbound) ; absent, une seule façon de jouer à deux. */
  modes: EngineMode[] | null;
  legends: string[];
  cards: PickerCards;
  colors: Record<string, string>;
  texts?: { auto?: string; randomHint?: string; search?: string };
  whoTitle: string;
  sets: string;
  watchInfo: string;
  about: string;
  /** Un deck automatique autour d'une légende (ou d'un leader), ou au hasard. */
  autoDeck: (legend: string | null) => Promise<L | null>;
  /** La partie contre l'IA gardée sur le téléphone, résumée. */
  saved: { watching: boolean; hint: string } | null;
  discardSave: () => void;
  /** Vérifie la partie auprès du moteur et la garde, avant d'ouvrir la table. */
  startSolo: (setup: {
    mode: EngineMode;
    players: { name: string; deck: L }[];
    bots: (BotLevel | null)[];
    watching: boolean;
    openLists: boolean;
  }) => Promise<void>;
  hostConfig: (mode: EngineMode, players: { name: string; deck: L }[]) => unknown;
  hostNeedDeck: string;
};

/** La page Jouer d'un jeu : `/play/:gameSlug`. */
export function PlayLobbyScreen() {
  const { gameSlug } = useParams();
  if (!isPlayGame(gameSlug)) return <Navigate to="/play?section=table" replace />;
  return gameSlug === "swu" ? <SwuLobbyScreen /> : <RiftboundLobbyScreen />;
}

function useLobby<T>(game: PlayGame) {
  const [lobby, setLobby] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void loadLobby(game).then((result) => {
      if (cancelled) return;
      if (result.ok) setLobby(result.lobby as T);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [game, tick]);
  return { lobby, failed, retry: () => setTick((value) => value + 1) };
}

function RiftboundLobbyScreen() {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const cards = useTableCards();
  const { lobby, failed, retry } = useLobby<RiftboundLobby>("riftbound");
  const [saved, setSaved] = useState<SoloSave | null>(readSoloSave);

  if (!lobby) return <LobbyShell title={t("title")} failed={failed} onRetry={retry} />;

  const kit: LobbyKit<EngineDeckList> = {
    game: "riftbound",
    lobby,
    modes: ENGINE_MODES,
    legends: lobby.legends,
    cards,
    colors: DOMAIN_HEX,
    whoTitle: t("lobby.whoTitle"),
    sets: t("lobby.sets"),
    watchInfo: t("lobby.watchInfo"),
    about: t("lobby.about"),
    autoDeck: async (legend) => {
      const engine = await loadEngine();
      return JSON.parse(engine.auto_deck(legend ?? pickRandom(lobby.legends), randomSeed())) as EngineDeckList | null;
    },
    saved: saved
      ? {
          watching: saved.seat === null,
          hint: t(saved.seat === null ? "lobby.resumeWatchHint" : "lobby.resumeHint", {
            mode: t(`mode.${saved.record.config.mode}`),
            moves: saved.record.actions.length,
          }),
        }
      : null,
    discardSave: () => {
      writeSoloSave(null);
      setSaved(null);
    },
    startSolo: async ({ mode, players, bots, watching, openLists }) => {
      const engine = await loadEngine();
      const save: SoloSave = {
        seat: watching ? null : 0,
        bots,
        record: {
          config: {
            mode,
            // Le joueur paie lui-même ses cartes (le panneau de paiement), comme sur le site.
            players: players.map((player, seat) => (bots[seat] === null ? { ...player, manual_pay: true } : player)),
            ...(openLists ? { open_decklists: true } : {}),
          },
          seed: randomSeed(),
          actions: [],
        },
      };
      // Le moteur refuse ici une configuration qu'il ne sait pas jouer, avant d'ouvrir la table.
      engine.Table.restore(JSON.stringify(save.record), JSON.stringify(bots)).free();
      writeSoloSave(save);
      navigate("/play/riftbound/solo");
    },
    hostConfig: (mode, players) => ({ mode, players }),
    hostNeedDeck: t("host.needDeck"),
  };
  return <LobbyView kit={kit} />;
}

function SwuLobbyScreen() {
  const ts = usePlayT("PlaySwu");
  const navigate = useNavigate();
  const cards: SwuTableCards = useSwuTableCards();
  const pickerCards = useMemo(() => swuPickerCards(cards), [cards]);
  const { lobby, failed, retry } = useLobby<SwuLobby>("swu");
  const [saved, setSaved] = useState<SwuSave | null>(readSwuSave);

  if (!lobby) return <LobbyShell title={ts("title")} failed={failed} onRetry={retry} />;

  const kit: LobbyKit<SwuDeckList> = {
    game: "swu",
    lobby,
    modes: null,
    legends: lobby.leaders,
    cards: pickerCards,
    colors: ASPECT_HEX,
    texts: { auto: ts("lobby.deckAuto"), randomHint: ts("lobby.deckRandomHint"), search: ts("lobby.deckSearch") },
    whoTitle: ts("lobby.whoTitle"),
    sets: ts("lobby.sets"),
    watchInfo: ts("lobby.watchInfo"),
    about: ts("lobby.about"),
    autoDeck: async (picked) => {
      const engine = await loadSwuEngine();
      const leader = picked ?? pickRandom(lobby.leaders);
      // La base : une de celles qui partagent un aspect avec le leader, pour un deck sans pénalité.
      const aspects = cards[leader]?.aspects ?? [];
      const fitting = lobby.bases.filter((base) => cards[base]?.aspects.some((aspect) => aspects.includes(aspect)));
      const base = pickRandom(fitting.length > 0 ? fitting : lobby.bases);
      return JSON.parse(engine.swu_auto_deck(leader, base, randomSeed())) as SwuDeckList | null;
    },
    saved: saved
      ? {
          watching: saved.seat === null,
          hint: ts("lobby.resumeHint", {
            players: saved.record.config.players.map((player) => player.name).join(" · "),
            moves: saved.record.actions.length,
          }),
        }
      : null,
    discardSave: () => {
      writeSwuSave(null);
      setSaved(null);
    },
    startSolo: async ({ players, bots, watching }) => {
      const engine = await loadSwuEngine();
      const save: SwuSave = {
        seat: watching ? null : 0,
        bots,
        record: { config: { players }, seed: randomSeed(), actions: [] },
      };
      const table = new engine.SwuTable(JSON.stringify(save.record.config), save.record.seed, JSON.stringify(bots));
      save.record = JSON.parse(table.record()) as SwuSave["record"];
      table.free();
      writeSwuSave(save);
      navigate("/play/swu/solo");
    },
    hostConfig: (_mode, players) => ({ players }),
    hostNeedDeck: ts("lobby.hostNeedDeck"),
  };
  return <LobbyView kit={kit} />;
}

function LobbyShell({ title, failed, onRetry }: { title: string; failed: boolean; onRetry: () => void }) {
  const t = usePlayT("Play");
  return (
    <div className="screen">
      <BackHeader title={title} />
      <div className="pt-wait">
        <p className="muted">{failed ? t("error.SERVER") : t("status.loading")}</p>
        {failed && (
          <button type="button" className="btn btn--outline" onClick={onRetry}>
            {t("retry")}
          </button>
        )}
      </div>
    </div>
  );
}

function LobbyView<L extends object>({ kit }: { kit: LobbyKit<L> }) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const { lobby, game } = kit;
  const [mode, setMode] = useState<EngineMode>("duel");
  const [opponent, setOpponent] = useState<Opponent>("ai");
  const [choice, setChoice] = useState<DeckChoice | null>(null);
  const [botDecks, setBotDecks] = useState<BotDeckChoice[]>([]);
  const [botLevels, setBotLevels] = useState<BotLevel[]>([]);
  const [openLists, setOpenLists] = useState(false);
  const [found, setFound] = useState<Record<string, LobbyDeck<unknown>>>({});
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  const decks = lobby.decks as LobbyDeck<unknown>[];
  const watching = opponent === "watch";
  const seatCount = kit.modes ? modePlayers(mode) : 2;
  const botDeckOf = (seat: number): BotDeckChoice => botDecks[seat] ?? { kind: "random" };
  const botLevelOf = (seat: number): BotLevel => botLevels[seat] ?? "normal";
  const deckById = (id: string) => decks.find((deck) => deck.id === id) ?? found[id];
  const me = lobby.name ?? t("lobby.you");
  const search = useMemo(() => (query: string) => searchPlayDecks<LobbyDeck<unknown>>(game, query), [game]);

  const listOf = async (picked: BotDeckChoice | null): Promise<L | null> => {
    if (!picked) return null;
    if (picked.kind === "deck") return (deckById(picked.deckId)?.list as L | null) ?? null;
    return kit.autoDeck(picked.kind === "auto" ? picked.legend : null);
  };

  const startSolo = async () => {
    setBusy(true);
    try {
      const players: { name: string; deck: L }[] = [];
      const bots: (BotLevel | null)[] = [];
      if (!watching) {
        const deck = await listOf(choice);
        if (!deck) throw new Error(t("error.INVALID_DECK"));
        players.push({ name: me, deck });
        bots.push(null);
      }
      for (let seat = players.length; seat < seatCount; seat++) {
        const deck = await listOf(botDeckOf(seat));
        if (!deck) throw new Error(t("error.INVALID_DECK"));
        players.push({ name: t("lobby.botName", { number: watching ? seat + 1 : seat }), deck });
        bots.push(botLevelOf(seat));
      }
      await kit.startSolo({ mode, players, bots, watching, openLists });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "error");
      setBusy(false);
    }
  };

  const createOnline = async () => {
    setBusy(true);
    const result = await createTable(game, mode, choice);
    if (result.ok) {
      navigate(`/play/${game}/tables/${result.id}`);
      return;
    }
    setBusy(false);
    toast(withDeckProblems(t, t(`error.${result.error}`), result.details), "error");
  };

  const joinCode = code.trim().toLowerCase().split("id=").pop()?.split("&")[0] ?? "";

  const opponents: { key: Opponent; icon: ReactNode; title: string; hint: string }[] = [
    { key: "ai", icon: <BotIcon size={18} />, title: t("lobby.ai"), hint: t("lobby.aiHint") },
    { key: "watch", icon: <EyeIcon size={18} />, title: t("lobby.watch"), hint: t("lobby.watchHint") },
    { key: "online", icon: <GlobeIcon size={18} />, title: t("lobby.online"), hint: t("lobby.onlineHint") },
    { key: "host", icon: <ServerIcon size={18} />, title: t("lobby.host"), hint: t("lobby.hostHint") },
  ];

  const picker = (seat: number, name: string, bot: boolean) => (
    <DeckPicker
      title={t("deck.of", { name })}
      decks={decks}
      legends={kit.legends}
      cards={kit.cards}
      colors={kit.colors}
      texts={kit.texts}
      search={search}
      value={bot ? botDeckOf(seat) : choice}
      allowRandom={bot}
      onChange={(next, deck) => {
        if (deck) setFound((previous) => ({ ...previous, [deck.id]: deck }));
        if (!bot) {
          if (next.kind !== "random") setChoice(next);
          return;
        }
        setBotDecks((previous) => {
          const copy = [...previous];
          copy[seat] = next;
          return copy;
        });
      }}
    />
  );

  const hostKit: HostKit<L> = {
    game,
    seats: seatCount - 1,
    config: (players) => kit.hostConfig(mode, players),
    auto: () => kit.autoDeck(null),
    resolve: (reference) => resolveDeck<L>(game, reference),
    needDeck: kit.hostNeedDeck,
  };

  const tables = (
    <section className="play-section">
      <h2 className="play-section__title">{t("lobby.tablesTitle")}</h2>
      {lobby.tables.length === 0 ? (
        <p className="muted">{t("lobby.noTables")}</p>
      ) : (
        <div className="play-tables">
          {lobby.tables.map((table) => (
            <TableRow key={table.id} table={table} game={game} />
          ))}
        </div>
      )}
    </section>
  );

  const signIn = (text: string) => (
    <div className="pt-row-wrap">
      <span className="muted">{text}</span>
      <Link to="/login" className="btn btn--outline btn--sm">
        {t("lobby.signIn")}
      </Link>
    </div>
  );

  return (
    <div className="screen play-screen">
      <BackHeader title={game === "swu" ? t("lobby.titleSwu") : t("title")} />
      <div className="play-split">
        <div className="play-screen">
          {kit.saved && (
            <section className="play-resume">
              <b>{t(kit.saved.watching ? "lobby.resumeWatchTitle" : "lobby.resumeTitle")}</b>
              <span className="muted">{kit.saved.hint}</span>
              <div className="pt-row-wrap">
                <button type="button" className="btn btn--grad" onClick={() => navigate(`/play/${game}/solo`)}>
                  {t("lobby.resume")}
                </button>
                <button type="button" className="btn btn--ghost" onClick={kit.discardSave}>
                  {t("lobby.discard")}
                </button>
              </div>
            </section>
          )}

          {kit.modes && (
            <section className="play-section">
              <h2 className="play-section__title">{t("lobby.modeTitle")}</h2>
              <div className="chip-row play-chips">
                {kit.modes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    className={`chip-filter${mode === value ? " chip-filter--active" : ""}`}
                    onClick={() => setMode(value)}
                  >
                    {t(`mode.${value}`)}
                  </button>
                ))}
              </div>
              <p className="muted play-small">{t(`modeHint.${mode}`)}</p>
            </section>
          )}

          <section className="play-section">
            <h2 className="play-section__title">{kit.whoTitle}</h2>
            <div className="play-modes play-modes--four">
              {opponents.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={opponent === entry.key}
                  className={`play-mode${opponent === entry.key ? " play-mode--active" : ""}`}
                  onClick={() => setOpponent(entry.key)}
                >
                  {entry.icon}
                  <b>{entry.title}</b>
                  <span>{entry.hint}</span>
                </button>
              ))}
            </div>

            {!watching && (
              <SeatRow color={SEAT_COLORS[0]} name={me} you={t("lobby.youBadge")}>
                {picker(0, me, false)}
              </SeatRow>
            )}
            {(opponent === "ai" || watching) &&
              Array.from({ length: seatCount }, (_, seat) => seat)
                .filter((seat) => watching || seat > 0)
                .map((seat) => {
                  const name = t("lobby.botName", { number: watching ? seat + 1 : seat });
                  return (
                    <SeatRow key={seat} color={SEAT_COLORS[seat]} name={name} bot>
                      {picker(seat, name, true)}
                      <div className="play-levels" role="group" aria-label={t("lobby.levelOf", { name })}>
                        {BOT_LEVELS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={botLevelOf(seat) === value}
                            className={`play-level${botLevelOf(seat) === value ? " play-level--active" : ""}`}
                            onClick={() =>
                              setBotLevels((previous) => {
                                const copy = [...previous];
                                copy[seat] = value;
                                return copy;
                              })
                            }
                          >
                            {t(`level.${value}`)}
                          </button>
                        ))}
                      </div>
                    </SeatRow>
                  );
                })}

            {!lobby.signedIn && signIn(t("lobby.signInForDecks"))}
            <p className="muted play-small">{kit.sets}</p>
          </section>

          {(opponent === "ai" || watching) && (
            <section className="play-section">
              {watching && <p className="muted play-small">{kit.watchInfo}</p>}
              {game === "riftbound" && (
                <div className="play-toggle-row">
                  <Toggle checked={openLists} onChange={setOpenLists} label={t("lobby.openLists")} hint={t("lobby.openListsHint")} />
                </div>
              )}
              <button
                type="button"
                className="btn btn--grad btn--block"
                disabled={busy || (!watching && !choice)}
                onClick={() => void startSolo()}
              >
                {busy ? t("status.loading") : watching ? t("lobby.startWatch") : t("lobby.startSolo")}
              </button>
              {kit.saved && <p className="muted play-small">{t("lobby.replaces")}</p>}
            </section>
          )}

          {opponent === "online" && (
            <section className="play-section">
              {!lobby.online ? (
                <p className="muted">{t("lobby.offline")}</p>
              ) : !lobby.signedIn ? (
                signIn(t("lobby.signInForOnline"))
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--grad btn--block"
                    disabled={busy || !choice}
                    onClick={() => void createOnline()}
                  >
                    {t("lobby.createTable")}
                  </button>
                  <label className="field">
                    <span className="field__label">{t("lobby.joinLabel")}</span>
                    <div className="pt-row">
                      <input
                        className="play-input pt-grow"
                        value={code}
                        autoCapitalize="off"
                        autoCorrect="off"
                        onChange={(event) => setCode(event.target.value)}
                        placeholder={t("lobby.joinPlaceholder")}
                      />
                      <button
                        type="button"
                        className="btn btn--outline"
                        disabled={!/^[a-z0-9]{4,32}$/.test(joinCode)}
                        onClick={() => navigate(`/play/${game}/tables/${joinCode}`)}
                      >
                        {t("lobby.join")}
                      </button>
                    </div>
                  </label>
                </>
              )}
            </section>
          )}

          {opponent === "host" && (
            <section className="play-section">
              <HostPanel<L>
                hostName={me}
                hostDeck={() => listOf(choice)}
                kit={hostKit}
                onOpen={(server, ticket) => navigate(remotePath(game, server, ticket))}
              />
            </section>
          )}
        </div>

        <div className="play-screen">
          {tables}
          <section className="play-section">
            <h2 className="play-section__title">{t("lobby.aboutTitle")}</h2>
            <p className="muted play-small">{kit.about}</p>
          </section>
        </div>
      </div>
      {node}
    </div>
  );
}

function SeatRow({
  color,
  name,
  you,
  bot = false,
  children,
}: {
  color: string;
  name: string;
  you?: string;
  bot?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="play-seat">
      <span className="play-seat__icon" style={{ color }}>
        {bot ? <BotIcon size={18} /> : <span className="pt-dot" style={{ background: color, width: 12, height: 12 }} />}
      </span>
      <div className="play-seat__body">
        <span className="play-seat__name">
          {name}
          {you && <span className="chip play-you">{you}</span>}
        </span>
        {children}
      </div>
    </div>
  );
}

function TableRow({ table, game }: { table: GameTableSummary; game: PlayGame }) {
  const t = usePlayT("Play");
  return (
    <Link to={`/play/${game}/tables/${table.id}`} className="play-table-row">
      <span className="play-deck__body">
        <span className="play-deck__name">{game === "swu" ? t("lobby.swuTable") : t(`mode.${table.mode}`)}</span>
        <span className="play-deck__sub">{table.seats.map((seat) => seat.name).join(" · ")}</span>
      </span>
      <span className={`chip${table.status === "playing" ? " chip--accent" : ""}`}>{t(`tableStatus.${table.status}`)}</span>
    </Link>
  );
}

export type { SwuLobbyDeck };
