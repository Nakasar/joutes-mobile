import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

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
import { beatenLevels, readHistory, writeLastSetup, type SoloMeta } from "./history";
import { BackIcon, BotIcon, CheckIcon, ChevronDownIcon, EyeIcon, GlobeIcon, PlayIcon, ServerIcon } from "./icons";
import { readSwuSave, writeSwuSave, type SwuSave } from "./swu/useSwuSoloGame";
import { useSwuTableCards } from "./swu/useSwuTableCards";
import { usePlayT } from "./t";
import { Toggle, useToast } from "./ui";
import { readSoloSave, writeSoloSave, type SoloSave } from "./useSoloGame";
import { useTableCards } from "./useTableCards";
import { remotePath } from "./remote";

/** Qui joue : moi contre l'IA, des IA entre elles (je regarde), en ligne, ou sur un serveur. */
type Opponent = "ai" | "watch" | "online" | "host";


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
  gameName: string;
  /** La légende (le leader à SWU) d'un deck, pour son illustration. */
  legendOf: (deck: L) => string | null;
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
    meta: SoloMeta;
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
    gameName: "Riftbound",
    legendOf: (deck) => deck.legend,
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
    startSolo: async ({ mode, players, bots, watching, openLists, meta }) => {
      const engine = await loadEngine();
      const save: SoloSave = {
        seat: watching ? null : 0,
        bots,
        meta,
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
      if (!watching) writeLastSetup("riftbound", { bots, record: save.record, meta });
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
    gameName: "Star Wars: Unlimited",
    legendOf: (deck) => deck.leader,
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
    startSolo: async ({ players, bots, watching, meta }) => {
      const engine = await loadSwuEngine();
      const save: SwuSave = {
        seat: watching ? null : 0,
        bots,
        meta,
        record: { config: { players }, seed: randomSeed(), actions: [] },
      };
      const table = new engine.SwuTable(JSON.stringify(save.record.config), save.record.seed, JSON.stringify(bots));
      save.record = JSON.parse(table.record()) as SwuSave["record"];
      table.free();
      writeSwuSave(save);
      if (!watching) writeLastSetup("swu", { bots, record: { ...save.record, actions: [] }, meta });
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
  const { t: th } = useTranslation();
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const { lobby, game } = kit;
  const [mode, setMode] = useState<EngineMode>("duel");
  const [searchParams] = useSearchParams();
  const [opponent, setOpponent] = useState<Opponent>(() => {
    const way = searchParams.get("way");
    return way === "online" || way === "host" || way === "watch" ? way : "ai";
  });
  const [choice, setChoice] = useState<DeckChoice | null>(null);
  const [botDecks, setBotDecks] = useState<BotDeckChoice[]>([]);
  const [botLevels, setBotLevels] = useState<BotLevel[]>([]);
  const [openLists, setOpenLists] = useState(false);
  const [found, setFound] = useState<Record<string, LobbyDeck<unknown>>>({});
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [othersOpen, setOthersOpen] = useState(false);
  const history = useMemo(() => readHistory().filter((entry) => entry.game === kit.game), [kit.game]);
  const beaten = useMemo(() => beatenLevels(kit.game, history), [kit.game, history]);

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

  /** Le nom et l'illustration d'un deck choisi, pour l'accueil et l'historique. */
  const describe = (picked: BotDeckChoice | null, deck: L): { name: string; image?: string } => {
    const legend = kit.legendOf(deck);
    const legendName = legend ? (kit.cards[legend]?.name ?? legend) : "";
    const image = legend ? kit.cards[legend]?.image : undefined;
    if (picked?.kind === "deck") return { name: deckById(picked.deckId)?.name ?? legendName, image };
    return { name: legendName || t("deck.random"), image };
  };

  const startSolo = async () => {
    setBusy(true);
    try {
      const players: { name: string; deck: L }[] = [];
      const bots: (BotLevel | null)[] = [];
      const described: { name: string; image?: string }[] = [];
      if (!watching) {
        const deck = await listOf(choice);
        if (!deck) throw new Error(t("error.INVALID_DECK"));
        players.push({ name: me, deck });
        bots.push(null);
        described.push(describe(choice, deck));
      }
      for (let seat = players.length; seat < seatCount; seat++) {
        const deck = await listOf(botDeckOf(seat));
        if (!deck) throw new Error(t("error.INVALID_DECK"));
        players.push({ name: t("lobby.botName", { number: watching ? seat + 1 : seat }), deck });
        bots.push(botLevelOf(seat));
        described.push(describe(botDeckOf(seat), deck));
      }
      const meta: SoloMeta = {
        deckName: described[0]?.name,
        image: described[0]?.image,
        opponentName: described[1]?.name,
        opponentImage: described[1]?.image,
        startedAt: Date.now(),
      };
      await kit.startSolo({ mode, players, bots, watching, openLists, meta });
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

  const picker = (seat: number, name: string, bot: boolean, label?: string, tone?: "me" | "ai") => (
    <DeckPicker
      variant={label ? "hero" : "row"}
      label={label}
      tone={tone}
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

  // L'illustration du haut : la légende de mon deck, sinon celle d'une IA, sinon une du jeu.
  const imageOf = (picked: BotDeckChoice | null): string | undefined => {
    if (!picked || picked.kind === "random") return undefined;
    const legend = picked.kind === "deck" ? deckById(picked.deckId)?.legend : picked.legend;
    return legend ? kit.cards[legend]?.image : undefined;
  };
  const heroImage =
    imageOf(watching ? botDeckOf(0) : choice) ??
    imageOf(botDeckOf(1)) ??
    kit.legends.map((legend) => kit.cards[legend]?.image).find(Boolean);

  // Le défi proposé sous l'IA : ce qu'on a déjà battu, et le palier suivant.
  const nextUnbeaten = BOT_LEVELS.find((level) => !beaten.has(level));
  const challengeOf = (level: BotLevel): string => {
    const wins = history.filter((entry) => entry.outcome === "won" && entry.level === level).length;
    const name = t(`level.${level}`);
    if (wins > 0) {
      const done = th("playHub.lobby.winsAtLevel", { count: wins, level: name });
      return nextUnbeaten ? `${done} ${th("playHub.lobby.nextChallenge", { level: t(`level.${nextUnbeaten}`) })}` : done;
    }
    if (beaten.size === 0) return th("playHub.lobby.firstChallenge", { level: name });
    return nextUnbeaten ? th("playHub.lobby.nextChallenge", { level: t(`level.${nextUnbeaten}`) }) : th("playHub.lobby.allBeaten");
  };

  const levels = (seat: number, name: string) => (
    <div className="play-segment" role="group" aria-label={t("lobby.levelOf", { name })}>
      {BOT_LEVELS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={botLevelOf(seat) === value}
          className={`play-segment__item${botLevelOf(seat) === value ? " play-segment__item--active" : ""}${value === "hard" ? " play-segment__item--gold" : ""}`}
          onClick={() =>
            setBotLevels((previous) => {
              const copy = [...previous];
              copy[seat] = value;
              return copy;
            })
          }
        >
          {t(`level.${value}`)}
          {beaten.has(value) && (
            <span className="play-segment__check" aria-label={th("playHub.lobby.beaten")}>
              <CheckIcon size={13} />
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const solo = opponent === "ai" || watching;
  const botSeats = Array.from({ length: seatCount }, (_, seat) => seat).filter((seat) => watching || seat > 0);
  const others: { key: Opponent; icon: ReactNode; title: string; hint: string }[] = [
    opponent !== "ai" ? opponents[0] : null,
    ...opponents.slice(1),
  ].filter((entry): entry is (typeof opponents)[number] => entry !== null);

  return (
    <div className="screen play-screen play-lobby">
      <header className="play-hero" style={heroImage ? ({ "--hero": `url("${heroImage}")` } as CSSProperties) : undefined}>
        <button type="button" className="play-hero__back" aria-label={th("common.back")} onClick={() => navigate(-1)}>
          <BackIcon size={20} />
        </button>
        <div className="play-hero__titles">
          <p className="play-hero__game">{kit.gameName}</p>
          <h1 className="play-hero__title">{th("playHub.lobby.newGame")}</h1>
        </div>
      </header>

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
            <div className="play-formats" role="group" aria-label={t("lobby.modeTitle")}>
              {kit.modes.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  title={t(`mode.${value}`)}
                  className={`play-format${mode === value ? " play-format--active" : ""}`}
                  onClick={() => setMode(value)}
                >
                  {th(`playHub.lobby.modeShort.${value}`)}
                </button>
              ))}
            </div>
          )}

          {opponent !== "ai" && (
            <p className="play-way">
              {opponents.find((entry) => entry.key === opponent)?.icon}
              <b>{opponents.find((entry) => entry.key === opponent)?.title}</b>
              <span className="muted">{opponents.find((entry) => entry.key === opponent)?.hint}</span>
            </p>
          )}

          <div className="play-versus">
            {!watching &&
              picker(0, me, false, th("playHub.lobby.you"), "me")}
            {solo &&
              botSeats.map((seat, index) => {
                const name = t("lobby.botName", { number: watching ? seat + 1 : seat });
                return (
                  <div key={seat} className="play-versus__item">
                    {(!watching || index > 0) && (
                      <span className="play-versus__badge" aria-hidden>
                        {th("playHub.lobby.vs")}
                      </span>
                    )}
                    <div className="play-opponent">
                      {picker(seat, name, true, seatCount > 2 || watching ? name : th("playHub.lobby.ai"), "ai")}
                      {levels(seat, name)}
                      {!watching && index === 0 && <p className="muted play-small">{challengeOf(botLevelOf(seat))}</p>}
                    </div>
                  </div>
                );
              })}
          </div>

          {!lobby.signedIn && signIn(t("lobby.signInForDecks"))}

          {solo && (
            <>
              {watching && <p className="muted play-small">{kit.watchInfo}</p>}
              {game === "riftbound" && (
                <div className="play-toggle-row">
                  <Toggle checked={openLists} onChange={setOpenLists} label={t("lobby.openLists")} hint={t("lobby.openListsHint")} />
                </div>
              )}
              {kit.saved && <p className="muted play-small">{t("lobby.replaces")}</p>}
            </>
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

          <section className={`play-others${othersOpen ? " play-others--open" : ""}`}>
            <button type="button" className="play-others__head" aria-expanded={othersOpen} onClick={() => setOthersOpen((open) => !open)}>
              <b className="pt-grow">{th("playHub.lobby.otherWays")}</b>
              <span className="muted play-small">{th("playHub.lobby.otherWaysHint")}</span>
              <ChevronDownIcon size={16} />
            </button>
            {othersOpen && (
              <div className="play-others__list">
                {others.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={opponent === entry.key}
                    className={`play-other${opponent === entry.key ? " play-other--active" : ""}`}
                    onClick={() => {
                      setOpponent(entry.key);
                      setOthersOpen(false);
                    }}
                  >
                    <span className="play-other__icon">{entry.icon}</span>
                    <span className="play-deck__body">
                      <b>{entry.key === "ai" ? th("playHub.lobby.vsAi") : entry.title}</b>
                      <span className="muted play-small">{entry.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <p className="muted play-small">{kit.sets}</p>
        </div>

        <div className="play-screen">
          {tables}
          <section className="play-section">
            <h2 className="play-section__title">{t("lobby.aboutTitle")}</h2>
            <p className="muted play-small">{kit.about}</p>
          </section>
        </div>
      </div>

      {solo && (
        <div className="play-launch">
          <button
            type="button"
            className="play-launch__button"
            disabled={busy || (!watching && !choice)}
            onClick={() => void startSolo()}
          >
            <PlayIcon size={18} />
            {busy ? t("status.loading") : watching ? t("lobby.startWatch") : t("lobby.startSolo")}
          </button>
          {!watching && <p className="play-launch__note">{th("playHub.lobby.offlineNote")}</p>}
        </div>
      )}
      {node}
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
