import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { matchOf, matchWinner, readLimitedSave, writeLimitedSave, type LimitedSave, type LimitedView } from "../../engine/limited";
import { usePlayT } from "../t";
import { useToast } from "../ui";
import { DraftScreen } from "./DraftScreen";
import type { LimitedKit, MatchRecord } from "./kit";
import { LimitedResults } from "./LimitedResults";
import { SealedOpening } from "./SealedOpening";
import { useLimitedEvent, type LimitedFeed } from "./useLimitedEvent";
import { ActionBar, EventHeader, SeatStrip, type EventStep } from "./widgets";

/** Un écran sans évènement à montrer : un message et le retour à l'accueil. */
export function LimitedMessage({ children }: { children: ReactNode }) {
  return (
    <div className="screen lim lim--plain">
      <div className="lim-panel lim-panel--center">{children}</div>
    </div>
  );
}

/**
 * Un scellé ou un draft contre des IA, du premier booster au match : ouvrir
 * (ou drafter), construire, puis jouer un match sur la table. Tout se passe
 * sur l'appareil ; l'évènement y est gardé et reprend à la réouverture.
 * `kit` dit de quel jeu : ses cartes, sa construction, sa table.
 */
export function LimitedGame<D, C, R extends MatchRecord, G>({ kit }: { kit: LimitedKit<D, C, R, G> }) {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const { cards, faces } = kit.useCards();
  const LOBBY = kit.base;
  const { storageKey } = kit;
  const [save, setSave] = useState<LimitedSave<D, R> | null>(() => readLimitedSave<D, R>(storageKey));
  const latest = useRef<LimitedSave<D, R> | null>(save);
  // Le match vient de finir sous nos yeux : on reste à la table jusqu'à ce que le joueur la quitte.
  const [atTable, setAtTable] = useState(false);
  const [summary, setSummary] = useState(false);

  /** Change la sauvegarde : à l'écran et sur l'appareil. */
  const patch = useCallback(
    (change: Partial<LimitedSave<D, R>>, quiet = false) => {
      if (!latest.current) return;
      const next = { ...latest.current, ...change };
      latest.current = next;
      writeLimitedSave(next, storageKey);
      if (!quiet) setSave(next);
    },
    [storageKey],
  );

  const feed = useLimitedEvent<D, G>(kit, save, (record) => patch({ record }));
  const { view, seat } = feed;

  const toLobby = () => navigate(LOBBY, { replace: true });
  const quit = () => {
    writeLimitedSave(null, storageKey);
    toLobby();
  };

  // Les matchs entre IA se jouent hors de l'écran, un par un.
  useBotMatches(feed, kit.worker);

  const mine = view ? matchOf(view, seat) : null;
  const pool = view?.you?.pool;
  const kept = save?.deck;
  const deck = useMemo(() => (kept && pool ? kit.fitToPool(kept, pool) : kit.emptyDeck()), [kept, pool, kit]);
  const building = view?.phase === "build" && !view.seats[seat]?.ready;
  const { check, status } = feed;
  const seq = view?.seq;
  const problems = useMemo(
    () => (building && status === "ready" ? check(deck) : []),
    // `seq` : le moteur a avancé, sa réponse peut changer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building, status, check, deck, seq],
  );

  // Le match est connu : sa partie est écrite une fois dans la sauvegarde, puis reprise telle quelle.
  const playing = view?.phase === "play" || view?.phase === "done";
  useEffect(() => {
    if (!playing || !mine || latest.current?.match) return;
    const game = feed.game(mine.index);
    if (!game) return;
    const table = mine.match.seats.indexOf(seat);
    patch({ match: { index: mine.index, bots: game.bots, record: kit.soloRecord(game, table) } });
  }, [playing, mine, seat, feed, patch, kit]);

  if (save && feed.status === "loading") {
    return (
      <LimitedMessage>
        <p className="muted">{t("loading")}</p>
      </LimitedMessage>
    );
  }

  if (save === null) {
    return (
      <LimitedMessage>
        <p className="muted">{t("none")}</p>
        <button type="button" className="btn btn--grad" onClick={toLobby}>
          {tPlay("solo.toLobby")}
        </button>
      </LimitedMessage>
    );
  }

  // Un évènement gardé que le moteur ne sait plus rouvrir (il a changé depuis).
  if (!view) {
    return (
      <LimitedMessage>
        <p className="muted">{t("broken")}</p>
        {feed.error && <p className="muted lim-small">{feed.error}</p>}
        <button type="button" className="btn btn--grad" onClick={quit}>
          {t("brokenLeave")}
        </button>
      </LimitedMessage>
    );
  }

  const { kind } = view;
  const title = t(`title.${kind}`);
  const subtitle = t("subtitle", { players: view.seats.length, sets: [...new Set(view.packs)].join(", ") });
  const out = view.seats[seat]?.out === true;

  const submit = () => {
    // Le bouton dit ce qui manque plutôt que de rester muet : la liste est dans l'onglet du deck.
    if (problems.length > 0) {
      toast(problems[0], "error");
      return;
    }
    const refused = feed.act({ type: "submit", deck });
    if (refused) toast(refused, "error");
  };

  const suggest = () => {
    const built = feed.suggest();
    if (!built) {
      toast(t("build.noSuggestion"), "error");
      return;
    }
    // Le deck du moteur vient avec ses runes : on les garde telles quelles.
    patch({ deck: built, runesByHand: false });
  };

  const page = (step: EventStep, body: ReactNode, plain = false) => (
    <div className={`screen lim${plain ? " lim--plain" : ""}`}>
      <EventHeader title={title} subtitle={subtitle} kind={kind} step={step} onBack={toLobby} onQuit={quit} />
      {body}
      {node}
    </div>
  );

  if (out && !mine) return page("build", <p className="lim-empty">{t("out")}</p>, true);

  if (view.phase === "draft") {
    return page(
      "open",
      <DraftScreen
        view={view}
        seat={seat}
        faces={faces}
        packSize={kit.rules("draft").packSize}
        onPick={(card) => feed.act({ type: "pick", code: card.code, foil: card.foil === true })}
        onRefused={(message) => toast(message, "error")}
      />,
    );
  }

  if (view.phase === "build") {
    if (!building) {
      return page(
        "build",
        <>
          <SeatStrip view={view} seat={seat} />
          <p className="lim-empty" role="status">
            {t("build.waiting")}
          </p>
        </>,
        true,
      );
    }
    const opened = save.opened ?? 0;
    if (kind === "sealed" && opened < view.packs.length) {
      return page(
        "open",
        <SealedOpening view={view} seat={seat} faces={faces} opened={opened} onOpened={(next) => patch({ opened: next })} />,
      );
    }
    return page(
      "build",
      <>
        <kit.Build
          view={view}
          seat={seat}
          cards={cards}
          faces={faces}
          deck={deck}
          byHand={save.runesByHand === true}
          problems={problems}
          onDeck={(next: D, runesByHand: boolean) => patch({ deck: next, runesByHand })}
        />
        <ActionBar>
          <button type="button" className="btn btn--outline" onClick={suggest}>
            {t("build.suggest")}
          </button>
          <button type="button" className={`btn btn--grad${problems.length > 0 ? " lim-bar__todo" : ""}`} onClick={submit}>
            {problems.length > 0 ? t("build.problems", { count: problems.length }) : t("build.submit")}
          </button>
        </ActionBar>
      </>,
    );
  }

  // Les matchs : le mien sur la table, puis le bilan.
  if (mine && save.match && (atTable || !mine.match.done) && !summary) {
    const { match, index } = mine;
    return (
      <>
        <Seated onSeated={() => setAtTable(true)} />
        <kit.SoloMatch
          key={save.match.record.seed}
          save={save.match}
          place={match.seats.indexOf(seat)}
          cards={cards}
          note={`${title} · ${t("step.match")}`}
          home={LOBBY}
          onRecord={(record) => patch({ match: latest.current?.match && { ...latest.current.match, record } }, true)}
          onResult={(winners) => {
            if (!match.done) feed.report(index, matchWinner(match, winners));
          }}
          afterResult={
            <div className="pt-row-wrap pt-row-wrap--center">
              <button type="button" className="pt-btn pt-btn--grad" onClick={() => setSummary(true)}>
                {t("match.toResults")}
              </button>
            </div>
          }
        />
      </>
    );
  }

  return page(
    "match",
    <LimitedResults
      view={view}
      seat={seat}
      deck={view.you?.deck ? <kit.DeckSummary deck={view.you.deck} cards={cards} faces={faces} /> : undefined}
      onReplay={
        mine && save.match
          ? () => {
              // Une revanche pour le plaisir : même decks, autre graine. Le résultat de l'évènement reste.
              patch({
                match: {
                  ...save.match!,
                  record: { ...save.match!.record, seed: Math.floor(Math.random() * 2 ** 31) + 1, actions: [] },
                },
              });
              setSummary(false);
              setAtTable(true);
            }
          : undefined
      }
      onLeave={quit}
    />,
    true,
  );
}

/** Dit une fois que la table du match est ouverte : on y reste après la fin de la partie. */
export function Seated({ onSeated }: { onSeated: () => void }) {
  const seated = useRef(onSeated);
  useEffect(() => seated.current(), []);
  return null;
}

type SimulationReply = { id: number; summary?: { winners: number[]; finished: boolean }; error?: string };

/**
 * Fait jouer les matchs qui n'opposent que des IA, dans un Web Worker (une
 * partie prend jusqu'à une seconde de calcul), et inscrit leur résultat.
 */
function useBotMatches<D, G>(feed: LimitedFeed<D, G>, open: () => Worker): void {
  const { view, game, report } = feed;
  const running = useRef<number | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );

  const next = nextBotMatch(view);
  useEffect(() => {
    if (next === null || running.current !== null || !view) return;
    const job = game(next);
    if (!job) return;
    const match = view.matches[next];
    running.current = next;
    worker.current ??= open();
    const current = worker.current;
    current.onmessage = (message: MessageEvent<SimulationReply>) => {
      if (message.data.id !== next) return;
      running.current = null;
      const summary = message.data.summary;
      // Une partie que le moteur n'a pas su finir compte comme nulle : l'évènement ne reste pas bloqué.
      report(next, summary?.finished ? matchWinner(match, summary.winners) : null);
    };
    // Un worker qui ne se charge pas ou plante ne répond jamais : le match compte
    // comme nul, et le prochain match repart sur un worker neuf.
    current.onerror = current.onmessageerror = () => {
      if (running.current !== next) return;
      running.current = null;
      current.terminate();
      if (worker.current === current) worker.current = null;
      report(next, null);
    };
    current.postMessage({ id: next, config: job.config, seed: job.seed, bots: job.bots });
  }, [next, view, game, report, open]);
}

/** Le premier match encore à jouer dont les deux joueurs sont des IA. */
function nextBotMatch(view: LimitedView<unknown> | null): number | null {
  if (!view || view.phase !== "play") return null;
  const index = view.matches.findIndex((match) => !match.done && match.seats.every((seat) => view.seats[seat]?.bot));
  return index < 0 ? null : index;
}
