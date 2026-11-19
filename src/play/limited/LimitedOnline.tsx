import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  addLimitedBot,
  joinLimitedEvent,
  leaveLimitedSeat,
  readLimitedEvent,
  startLimitedEvent,
  type LimitedEventState,
  type PlayGame,
  type PlayResult,
} from "../../api/play";
import { BackHeader } from "../../components/BackHeader";
import { config } from "../../config";
import { matchOf } from "../../engine/limited";
import { BOT_LEVELS, type BotLevel } from "../../engine/types";
import { BotIcon, CloseIcon, ShareIcon, UserIcon } from "../icons";
import { usePlayT } from "../t";
import { shareLink, useToast } from "../ui";
import { DraftScreen } from "./DraftScreen";
import type { LimitedKit, MatchRecord } from "./kit";
import { LimitedMessage, Seated } from "./LimitedGame";
import { LimitedResults } from "./LimitedResults";
import { useDelayLabel, useLimitedError } from "./LimitedSetup";
import { SealedOpening } from "./SealedOpening";
import { useOnlineLimitedEvent } from "./useOnlineLimitedEvent";
import { ActionBar, Countdown, EventHeader, SeatStrip, type EventStep } from "./widgets";

const POLL_MS = 3000;

/** Le lien d'un évènement, celui du site : il s'ouvre aussi dans un navigateur, et l'app le reconnaît. */
export function limitedEventLink(game: PlayGame, id: string): string {
  return `${config.webUrl}/games/${game}/play/limited/room?id=${id}`;
}

/**
 * Un scellé ou un draft en ligne : la salle d'attente tenue par Joutes, puis
 * l'évènement sur le serveur de parties.
 */
export function LimitedRoom<D, C, R extends MatchRecord, G>({
  kit,
  game,
  id,
}: {
  kit: LimitedKit<D, C, R, G>;
  game: PlayGame;
  id: string;
}) {
  const LOBBY = kit.base;
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  const errorText = useLimitedError();
  const delayLabel = useDelayLabel();
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const [state, setState] = useState<LimitedEventState | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // L'adresse est gardée telle qu'elle a été reçue : chaque lecture signe un
  // nouveau ticket, et changer d'adresse couperait la connexion pour rien.
  const [socket, setSocket] = useState<{ event: string; url: string; server: string } | null>(null);

  const refresh = useCallback(async (): Promise<LimitedEventState | null> => {
    const result = await readLimitedEvent(game, id);
    if (!result.ok) {
      setFailure(result.error);
      return null;
    }
    const { access } = result.state;
    setFailure(null);
    setState(result.state);
    setSocket((previous) =>
      access ? (previous?.event === access.event ? previous : { event: access.event, url: access.ws, server: access.server }) : null,
    );
    return result.state;
  }, [id, game]);

  const renew = useCallback(async () => (await refresh())?.access?.ws ?? null, [refresh]);

  const waiting = state?.event.status === "waiting";

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, refresh]);

  const run = async (action: () => Promise<PlayResult>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast(result.details?.length ? `${errorText(result.error)} ${result.details.join(" ")}` : errorText(result.error), "error");
    }
    await refresh();
  };

  const closed = (message: string) => (
    <LimitedMessage>
      <p className="muted">{message}</p>
      <Link to={LOBBY} replace className="btn btn--grad">
        {tPlay("solo.toLobby")}
      </Link>
    </LimitedMessage>
  );

  if (failure) return closed(errorText(failure));
  if (!state) {
    return (
      <LimitedMessage>
        <p className="muted">{t("loading")}</p>
      </LimitedMessage>
    );
  }

  const { event } = state;
  if (event.status === "cancelled") return closed(t("room.cancelled"));

  if (event.status === "playing" || event.status === "finished") {
    return (
      <OnlineLimited
        kit={kit}
        key={socket?.event ?? "none"}
        url={socket?.url ?? null}
        server={socket?.server ?? ""}
        renew={renew}
        storageKey={`${socket?.event ?? event.id}.${state.seat ?? "watch"}`}
      />
    );
  }

  const free = event.players - event.seats.length;
  const title = t(`room.title.${event.kind}`);

  return (
    <div className="screen lim lim--plain">
      <BackHeader title={title} />
      <section className="lim-panel">
        <div className="lim-row lim-row--between">
          <b>{t("room.settings", { players: event.players, sets: [...new Set(event.packs)].join(", ") })}</b>
          <span className="chip">{tPlay("room.code", { code: event.id })}</span>
        </div>
        <p className="muted lim-small">
          {event.kind === "draft"
            ? t("room.timersDraft", { pick: delayLabel(event.timers.pick), build: delayLabel(event.timers.build) })
            : t("room.timersSealed", { build: delayLabel(event.timers.build) })}
        </p>
        <p className="muted lim-small">{t("room.invite")}</p>
        <button
          type="button"
          className="btn btn--outline"
          onClick={() =>
            void shareLink(limitedEventLink(game, event.id), title).then((outcome) => {
              if (outcome === "copied") toast(tPlay("room.copied"));
            })
          }
        >
          <ShareIcon size={16} /> {t("room.share")}
        </button>
      </section>

      <section className="lim-panel">
        <h2 className="lim-title">{tPlay("room.seats", { taken: event.seats.length, total: event.players })}</h2>
        {event.seats.map((seat, index) => (
          <div key={index} className="lim-seat-row">
            {seat.bot ? <BotIcon size={16} /> : <UserIcon size={16} />}
            <b>{seat.name}</b>
            {seat.bot && <span className="muted lim-small">{tPlay("room.botSeat", { level: tPlay(`level.${seat.bot}`) })}</span>}
            {seat.host && <span className="lim-badge">{tPlay("room.host")}</span>}
            {(state.isHost || state.seat === index) && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await leaveLimitedSeat(game, event.id, index, seat.name);
                    if (result.ok && state.seat === index && state.isHost) navigate(LOBBY, { replace: true });
                    return result;
                  })
                }
              >
                <CloseIcon size={14} />{" "}
                {state.seat === index ? (state.isHost ? t("room.cancel") : tPlay("room.leave")) : tPlay("room.remove")}
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: free }, (_, index) => (
          <div key={`free-${index}`} className="lim-seat-row lim-seat-row--free">
            {tPlay("room.freeSeat")}
          </div>
        ))}

        {state.isHost && (
          <>
            {free > 0 && (
              <div className="lim-row">
                {BOT_LEVELS.map((level: BotLevel) => (
                  <button
                    key={level}
                    type="button"
                    className="btn btn--outline lim-grow"
                    disabled={busy}
                    onClick={() => void run(() => addLimitedBot(game, event.id, level))}
                  >
                    <BotIcon size={15} /> {tPlay("room.addBot", { level: tPlay(`level.${level}`) })}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn--grad btn--block"
              disabled={busy || event.seats.length < 2}
              onClick={() => void run(() => startLimitedEvent(game, event.id))}
            >
              {event.seats.length < 2 ? t("room.needTwo") : t("room.start", { count: event.seats.length })}
            </button>
            {free > 0 && event.seats.length >= 2 && <p className="muted lim-small">{t("room.freeHint")}</p>}
          </>
        )}
        {!state.isHost && state.seat !== null && <p className="muted lim-small">{tPlay("room.waitingHost")}</p>}
      </section>

      {state.seat === null && free > 0 && (
        <section className="lim-panel">
          <h2 className="lim-title">{t("room.join")}</h2>
          {!state.signedIn ? (
            <div className="lim-row">
              <span className="muted lim-grow">{t("room.signIn")}</span>
              <Link to="/login" className="btn btn--outline">
                {tPlay("lobby.signIn")}
              </Link>
            </div>
          ) : (
            <>
              <p className="muted lim-small">{t("room.joinHint")}</p>
              <button
                type="button"
                className="btn btn--grad btn--block"
                disabled={busy}
                onClick={() => void run(() => joinLimitedEvent(game, event.id))}
              >
                {t("room.sit")}
              </button>
            </>
          )}
        </section>
      )}
      {node}
    </div>
  );
}

/** Ce que l'appareil garde d'un évènement en ligne : le deck en chantier, rien que le serveur ne sache déjà. */
type Draft<D> = { deck?: D; runesByHand?: boolean; opened?: number };

const draftKey = (key: string) => `joutes.play.limited.online.${key}`;

function readDraft<D>(key: string): Draft<D> {
  try {
    const raw = window.localStorage.getItem(draftKey(key));
    const draft = raw ? (JSON.parse(raw) as Draft<D> | null) : null;
    return draft && typeof draft === "object" ? draft : {};
  } catch {
    return {};
  }
}

function writeDraft<D>(key: string, draft: Draft<D> | null): void {
  try {
    if (draft) window.localStorage.setItem(draftKey(key), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(key));
  } catch {
    // Stockage plein ou refusé : le deck en chantier ne survivra pas à une fermeture de l'app.
  }
}

/**
 * Un scellé ou un draft sur un serveur de parties, une fois lancé : drafter ou
 * ouvrir, construire, puis jouer son match sur la table du serveur. L'app ne
 * reçoit que ses propres cartes.
 *
 * `url` est l'adresse WebSocket de l'évènement, `server` celle du serveur (les
 * tables des matchs s'y ouvrent), `storageKey` nomme le deck en chantier gardé
 * sur l'appareil. `kit` dit de quel jeu.
 */
function OnlineLimited<D, C, R extends MatchRecord, G>({
  kit,
  url,
  server,
  renew,
  storageKey,
}: {
  kit: LimitedKit<D, C, R, G>;
  url: string | null;
  server: string;
  renew?: () => Promise<string | null>;
  storageKey: string;
}) {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const { cards, faces } = kit.useCards();
  const LOBBY = kit.base;
  const feed = useOnlineLimitedEvent<D>(url, renew);
  const { view, seat } = feed;
  const [draft, setDraft] = useState<Draft<D>>(() => readDraft<D>(storageKey));
  const [atTable, setAtTable] = useState(false);
  const [summary, setSummary] = useState(false);

  const patch = useCallback(
    (change: Draft<D>) =>
      setDraft((previous) => {
        const next = { ...previous, ...change };
        writeDraft(storageKey, next);
        return next;
      }),
    [storageKey],
  );

  // Un refus du serveur (carte déjà prise, deck illégal) est dit une fois.
  const refusal = feed.error;
  useEffect(() => {
    if (refusal) toast(refusal.message, "error");
    // `toast` change à chaque rendu : seul un nouveau refus compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refusal]);

  const me = seat === null ? null : (view?.seats[seat] ?? null);
  const pool = view?.you?.pool;
  const deck = useMemo(
    () => (draft.deck && pool ? kit.fitToPool(draft.deck, pool) : kit.emptyDeck()),
    [draft.deck, pool, kit],
  );
  const building = view?.phase === "build" && me !== null && !me.ready && !me.out;

  // Le serveur vérifie le deck à chaque changement, après un court répit.
  const serialized = useMemo(() => JSON.stringify(deck), [deck]);
  const { check, status } = feed;
  useEffect(() => {
    if (!building || status !== "ready") return;
    const timer = window.setTimeout(() => check(deck), 250);
    return () => window.clearTimeout(timer);
    // `serialized` dit quand le deck change vraiment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, status, serialized, check]);
  const verified = feed.checked?.deck === serialized;
  const problems = verified ? (feed.checked?.problems ?? []) : [];

  const toLobby = () => navigate(LOBBY, { replace: true });

  if (!url || (feed.status === "error" && !view)) {
    return (
      <LimitedMessage>
        <p>{t("online.unreachable")}</p>
        <p className="muted lim-small">{t("online.unreachableHint")}</p>
        <button type="button" className="btn btn--grad" onClick={toLobby}>
          {tPlay("solo.toLobby")}
        </button>
      </LimitedMessage>
    );
  }

  if (!view) {
    return (
      <LimitedMessage>
        <p className="muted">{t("loading")}</p>
      </LimitedMessage>
    );
  }

  const { kind } = view;
  const title = t(`title.${kind}`);
  const subtitle = t("subtitle", { players: view.seats.length, sets: [...new Set(view.packs)].join(", ") });
  const mine = seat === null ? null : matchOf(view, seat);
  const over = view.phase === "done" || (view.phase === "play" && (!mine || mine.match.done));
  // L'adversaire a quitté en plein match : le match est à moi, sa table n'ira pas plus loin.
  const opponentLeft =
    !!mine && mine.match.done && mine.match.seats.some((other) => other !== seat && view.seats[other]?.out);

  const leave = () => {
    writeDraft(storageKey, null);
    toLobby();
  };
  const quit = () => {
    // Partir avant la fin, c'est abandonner : le serveur n'attend plus ce siège.
    if (seat !== null && !over && !me?.out) feed.act({ type: "forfeit" });
    leave();
  };

  const page = (step: EventStep, body: ReactNode, options: { clock?: boolean; plain?: boolean } = {}) => (
    <div className={`screen lim${options.plain ? " lim--plain" : ""}`}>
      <EventHeader
        title={title}
        subtitle={subtitle}
        kind={kind}
        step={step}
        // Revenir à l'accueil ne quitte pas l'évènement : le serveur garde la place.
        onBack={toLobby}
        onQuit={quit}
        quitBody={seat === null || over ? t("online.quitWatching") : t("online.quitBody")}
      >
        {options.clock && <Countdown deadline={feed.deadline} />}
      </EventHeader>
      {feed.status === "reconnecting" && (
        <p className="lim-notice" role="status">
          {t("online.reconnecting")}
        </p>
      )}
      {body}
      {node}
    </div>
  );
  const strip = <SeatStrip view={view} seat={seat ?? -1} away={feed.away} />;

  // Un spectateur, ou un joueur sorti : il suit la table sans rien voir des cartes.
  if (seat === null || !view.you || (me?.out && !mine)) {
    const step: EventStep = view.phase === "draft" ? "open" : view.phase === "build" ? "build" : "match";
    return page(
      step,
      view.phase === "play" || view.phase === "done" ? (
        <LimitedResults view={view} seat={seat ?? -1} onLeave={leave} />
      ) : (
        <>
          {strip}
          <p className="lim-empty" role="status">
            {seat === null ? t("online.watching") : t("out")}
          </p>
        </>
      ),
      { plain: true },
    );
  }

  if (view.phase === "draft") {
    return page(
      "open",
      <DraftScreen
        view={view}
        seat={seat}
        faces={faces}
        packSize={kit.rules("draft").packSize}
        onPick={(card) => {
          // Un refus du serveur arrive plus tard, par la connexion.
          feed.act({ type: "pick", code: card.code, foil: card.foil === true });
          return null;
        }}
        onRefused={(message) => toast(message, "error")}
      />,
      { clock: true },
    );
  }

  if (view.phase === "build") {
    if (!building) {
      return page(
        "build",
        <>
          {strip}
          <p className="lim-empty" role="status">
            {t("build.waiting")}
          </p>
        </>,
        { plain: true },
      );
    }
    const opened = draft.opened ?? 0;
    if (kind === "sealed" && opened < view.packs.length) {
      return page(
        "open",
        <SealedOpening view={view} seat={seat} faces={faces} opened={opened} onOpened={(next) => patch({ opened: next })} />,
        { clock: true },
      );
    }
    const suggest = async () => {
      const built = await feed.suggest();
      if (built) patch({ deck: built, runesByHand: false });
      else toast(t("build.noSuggestion"), "error");
    };
    const submit = () => {
      if (problems.length > 0) toast(problems[0], "error");
      else if (verified) feed.act({ type: "submit", deck });
    };
    return page(
      "build",
      <>
        <kit.Build
          view={view}
          seat={seat}
          cards={cards}
          faces={faces}
          deck={deck}
          byHand={draft.runesByHand === true}
          problems={problems}
          onDeck={(next: D, runesByHand: boolean) => patch({ deck: next, runesByHand })}
        />
        <ActionBar>
          <button type="button" className="btn btn--outline" onClick={() => void suggest()}>
            {t("build.suggest")}
          </button>
          <button type="button" className={`btn btn--grad${!verified || problems.length > 0 ? " lim-bar__todo" : ""}`} onClick={submit}>
            {problems.length > 0 ? t("build.problems", { count: problems.length }) : t("build.submit")}
          </button>
        </ActionBar>
      </>,
      { clock: true },
    );
  }

  // Les matchs : le mien sur la table du serveur, puis le bilan.
  if (kit.OnlineMatch && mine && feed.table && (atTable || !mine.match.done) && !summary && !opponentLeft) {
    return (
      <>
        <Seated onSeated={() => setAtTable(true)} />
        <kit.OnlineMatch
          key={feed.table.game}
          table={feed.table}
          server={server}
          cards={cards}
          note={`${title} · ${t("step.match")}`}
          home={LOBBY}
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
    <>
      {opponentLeft && (
        <p className="lim-notice" role="status">
          {t("online.opponentLeft")}
        </p>
      )}
      {mine && !mine.match.done && !feed.table && (
        <p className="lim-empty" role="status">
          {t("online.tableOpening")}
        </p>
      )}
      <LimitedResults
        view={view}
        seat={seat}
        deck={view.you.deck ? <kit.DeckSummary deck={view.you.deck} cards={cards} faces={faces} /> : undefined}
        onLeave={leave}
      />
    </>,
    { plain: true },
  );
}
