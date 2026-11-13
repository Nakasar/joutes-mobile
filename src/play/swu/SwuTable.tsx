import "./swu-table.css";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { isLandscape, localizeSwuText, type SwuTableCard, type SwuTableCards } from "../../engine/swu/cards";
import {
  choiceCodes,
  clickableIds,
  groupChoices,
  isDirect,
  subjectOf,
  targetOf,
  viewCodes,
} from "../../engine/swu/table";
import type { SwuAction, SwuCardRef, SwuChoice, SwuKeyword, SwuPlayer, SwuUnit, SwuUpgrade } from "../../engine/swu/types";
import {
  BackIcon,
  FastIcon,
  FlagIcon,
  ForwardIcon,
  GaugeIcon,
  JournalIcon,
  PauseIcon,
  PlayIcon,
  StepIcon,
  WifiOffIcon,
} from "../icons";
import { usePlayT } from "../t";
import { Sheet, useSidePanel, useTableLayout } from "../ui";
import type { SwuFeed, SwuJournalEntry } from "./useSwuSoloGame";

/** Le temps laissé à chaque ligne du récit, en millisecondes. */
const SPEEDS = { slow: 1700, normal: 1000, fast: 500, instant: 0 } as const;
type Speed = keyof typeof SPEEDS;
const SPEED_STORAGE_KEY = "joutes.play.swu.speed";

/** Les lignes qui se lisent d'un coup d'œil : elles passent plus vite. */
const MINOR_EVENTS = new Set(["readied", "exhausted", "drew", "resourced", "phase_started", "round_started", "passed"]);

/** Les champs d'un évènement qui désignent une carte de la table. */
const OBJECT_FIELDS = ["card", "obj", "source", "unit", "attacker", "target", "leader", "on", "host"];

/** Les mots-clés qui pèsent sur le choix d'une attaque : affichés sur la carte. */
const SHOWN_KEYWORDS = ["sentinel", "saboteur", "overwhelm", "raid", "hidden", "ambush", "restore", "grit"];

type Inspect = { code: string; unit?: SwuUnit };
type Pile = { kind: "discard" | "resources"; seat: number };

type SwuTableProps = {
  feed: SwuFeed;
  cards: SwuTableCards;
  /** Où mène « Quitter la table ». */
  home: string;
  /** Ce qui suit l'annonce du résultat : rejouer, retour à l'accueil. */
  afterResult?: ReactNode;
  /** Une précision sur la partie (en ligne, sur un serveur), dans les réglages. */
  note?: ReactNode;
};

function readSpeed(): Speed {
  try {
    const stored = window.localStorage.getItem(SPEED_STORAGE_KEY);
    return stored && stored in SPEEDS ? (stored as Speed) : "normal";
  } catch {
    return "normal";
  }
}

function keywordName(keyword: SwuKeyword): { key: string; n?: number } {
  if (typeof keyword === "string") return { key: keyword };
  const [key, n] = Object.entries(keyword)[0] ?? ["", undefined];
  return { key, n };
}

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * La table de Star Wars: Unlimited, comme sur le site
 * (`components/play/swu/SwuTable.tsx`) : deux arènes, et au centre les bases et
 * les leaders. Ce que le moteur permet est cerclé ; une carte qui demande une
 * cible se touche d'abord, ses cibles s'allument ensuite. Au doigt, pas de
 * glisser-déposer : on touche la carte de la main, puis sa cible ou « Jouer ».
 * Mêmes mises en page que la table Riftbound : debout, couché avec le panneau
 * repliable, et tablette.
 */
export function SwuTable({ feed, cards, home, afterResult, note }: SwuTableProps) {
  const t = usePlayT("Play");
  const ts = usePlayT("PlaySwu");
  const navigate = useNavigate();
  const layout = useTableLayout();
  const [selected, setSelected] = useState<number | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [pile, setPile] = useState<Pile | null>(null);
  const [speed, setSpeedState] = useState<Speed>(readSpeed);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [sheet, setSheet] = useState<"journal" | "settings" | null>(null);
  const [panelJournal, setPanelJournal] = useState(false);
  // Le récit : tout ce qui précède `cursor` a été raconté.
  const [cursor, setCursor] = useState(0);

  const view = feed.update?.view ?? null;
  const prompt = feed.update?.prompt ?? null;
  const watching = feed.seat === null;
  const me = feed.seat ?? 0;

  const codes = useMemo(() => (view ? viewCodes(view) : new Map<number, string>()), [view]);
  const groups = useMemo(
    () => groupChoices(prompt, view ? clickableIds(view, me) : new Set<number>()),
    [prompt, view, me],
  );
  const { bySubject, loose } = groups;

  // ---- Le récit ----
  const from = Math.max(cursor, feed.toldFrom);
  const queue = speed === "instant" ? [] : feed.journal.filter((entry) => entry.key >= from);
  const telling: SwuJournalEntry | undefined = queue[0];
  const tellingKey = telling?.key;
  const tellingType = telling?.event.type;
  const backlog = queue.length;
  useEffect(() => {
    if (tellingKey === undefined) return;
    const pace = SPEEDS[speed] * (MINOR_EVENTS.has(tellingType ?? "") ? 0.45 : 1) * Math.min(1, 6 / backlog);
    const timer = window.setTimeout(() => setCursor(tellingKey + 1), Math.max(140, pace));
    return () => window.clearTimeout(timer);
  }, [tellingKey, tellingType, backlog, speed]);

  const lastKey = feed.journal.length > 0 ? feed.journal[feed.journal.length - 1].key : -1;
  const skip = () => setCursor(lastKey + 1);
  const { hold } = feed;
  const busy = backlog > 0 || paused;
  useEffect(() => {
    hold?.(busy);
  }, [busy, hold]);

  const setSpeed = (next: Speed) => {
    setSpeedState(next);
    // Ce qui attendait d'être raconté ne se rejoue pas au changement de rythme.
    skip();
    try {
      window.localStorage.setItem(SPEED_STORAGE_KEY, next);
    } catch {
      // Stockage refusé : le réglage vaut pour cette table.
    }
  };

  const result = (view?.result ?? null) as { winners?: number[]; reason?: string } | null;
  const deciding = Boolean(prompt) && !watching && !result;
  const decision = deciding && prompt ? `${prompt.kind}:${prompt.text}:${prompt.choices.length}:${lastKey}` : null;
  const panel = useSidePanel(layout === "portrait" ? null : decision);

  if (feed.status === "loading" || feed.status === "error" || !view) {
    return (
      <div className="pt pt-wait">
        <p className="pt-muted">{feed.status === "error" ? (feed.error ?? t("status.error")) : t("status.loading")}</p>
        <button type="button" className="pt-btn" onClick={() => navigate(home)}>
          {t("table.quit")}
        </button>
      </div>
    );
  }

  const mine = view.players.find((player) => player.seat === me) ?? view.players[0];
  const theirs = view.players.find((player) => player.seat !== me) ?? view.players[1];
  const names = view.players.map((player) => player.name);

  // La carte choisie n'existe que tant que la question la propose encore.
  const sel = selected !== null && bySubject.has(selected) ? selected : null;
  const selChoices = sel !== null ? (bySubject.get(sel) ?? []) : [];
  const targets = new Map<number, SwuChoice>();
  for (const choice of selChoices) {
    const target = targetOf(choice.action);
    if (target !== null && !targets.has(target)) targets.set(target, choice);
  }
  const selButtons = selChoices.filter((choice) => targetOf(choice.action) === null);

  const focus = new Set<number>();
  if (telling) {
    for (const field of OBJECT_FIELDS) {
      const value = telling.event[field];
      if (typeof value === "number") focus.add(value);
    }
  }
  const hit =
    telling?.event.type === "damaged" && typeof telling.event.target === "number"
      ? { id: telling.event.target, amount: Number(telling.event.amount), key: telling.key }
      : null;

  const act = (action: SwuAction) => {
    setSelected(null);
    setFilter("");
    feed.act(action);
  };

  /** Un toucher sur une carte de la table : la cible attendue, l'action de la carte, ou la carte en grand. */
  const click = (id: number, look: () => void) => {
    const target = sel !== null ? targets.get(id) : undefined;
    if (target) return act(target.action);
    const choices = bySubject.get(id);
    if (!choices) return look();
    if (isDirect(choices)) return act(choices[0].action);
    if (sel === id) {
      // Un second toucher joue la carte quand il n'y a qu'une façon de le faire.
      if (choices.length === 1 && targetOf(choices[0].action) === null) return act(choices[0].action);
      return setSelected(null);
    }
    setSelected(id);
  };

  /** L'état d'une carte de la table, d'après la question en cours. */
  const stateOf = (id: number, controller: number) => {
    const choices = bySubject.get(id);
    const direct = choices ? isDirect(choices) : false;
    return {
      sel: sel === id,
      tgt: (sel !== null && targets.has(id)) || (sel === null && direct && controller !== me),
      can: sel === null && Boolean(choices) && !(direct && controller !== me),
      dim: sel !== null && sel !== id && !targets.has(id),
      focus: focus.has(id),
    };
  };

  const rich = (text: string, list: Iterable<string>) => (
    <Rich text={text} codes={list} cards={cards} names={names} me={mine.name} onCard={(code) => setInspect({ code })} />
  );
  const label = (choice: SwuChoice) =>
    localizeSwuText(choice.label, choiceCodes(choice, codes), cards)
      .map((part) => part.text)
      .join("");

  const upgradeTabs = (upgrades: SwuUpgrade[]) => {
    const stacks = new Map<string, { code: string; ids: number[] }>();
    for (const upgrade of upgrades) {
      const stack = stacks.get(upgrade.code) ?? { code: upgrade.code, ids: [] };
      stack.ids.push(upgrade.id);
      stacks.set(upgrade.code, stack);
    }
    if (stacks.size === 0) return null;
    return (
      <div className="swu-ups">
        {[...stacks.values()].map((stack) => {
          const card = cards[stack.code];
          const pickable = stack.ids.find((id) => bySubject.has(id) || (sel !== null && targets.has(id)));
          const name = `${card?.title ?? stack.code}${stack.ids.length > 1 ? ` ×${stack.ids.length}` : ""}`;
          return (
            <button
              key={stack.code}
              type="button"
              className="swu-up"
              data-token={card?.kind === "token_upgrade" || undefined}
              data-can={pickable !== undefined || undefined}
              title={name}
              onClick={() => click(pickable ?? stack.ids[0], () => setInspect({ code: stack.code }))}
            >
              {name}
            </button>
          );
        })}
      </div>
    );
  };

  const unitCard = (unit: SwuUnit) => {
    const card = cards[unit.code];
    const state = stateOf(unit.id, unit.controller);
    const shown = unit.keywords
      .map(keywordName)
      .filter((keyword) => SHOWN_KEYWORDS.includes(keyword.key))
      .sort((a, b) => SHOWN_KEYWORDS.indexOf(a.key) - SHOWN_KEYWORDS.indexOf(b.key))
      .slice(0, 2)
      .map((keyword) => ({ label: ts(`kw.${keyword.key}`, { n: keyword.n ?? 0 }) }));
    if (view.attack?.[0] === unit.id) shown.unshift({ label: ts("tag.attacking") });
    return (
      <CardView
        key={unit.id}
        name={card?.name ?? unit.name}
        // Un leader déployé montre sa face unité quand le catalogue l'a.
        image={unit.leader ? (card?.back ?? card?.image) : card?.image}
        exhausted={unit.exhausted}
        tag={unit.exhausted ? ts("tag.exhausted") : undefined}
        power={unit.power}
        hp={unit.hp}
        damage={unit.damage}
        keywords={shown}
        note={unit.captives.length > 0 ? ts("captives", { count: unit.captives.length }) : undefined}
        float={hit?.id === unit.id ? hit : undefined}
        {...state}
        onClick={() => click(unit.id, () => setInspect({ code: unit.code, unit }))}
        onInspect={() => setInspect({ code: unit.code, unit })}
      >
        {upgradeTabs(unit.upgrades)}
      </CardView>
    );
  };

  const arena = (units: SwuUnit[], title: string) => (
    <div className="swu-zone">
      <div className="swu-row">{units.filter((unit) => unit.controller !== me).map(unitCard)}</div>
      <h3>{title}</h3>
      <div className="swu-row">{units.filter((unit) => unit.controller === me).map(unitCard)}</div>
    </div>
  );

  const baseOf = (player: SwuPlayer) => {
    const card = cards[player.base.code];
    const left = Math.max(0, player.base.hp - player.base.damage);
    return (
      <div className="swu-base" style={{ "--who": player.seat === me ? "var(--swu-me)" : "var(--swu-other)" } as CSSProperties}>
        <CardView
          name={ts("baseOf", { name: player.name })}
          image={card?.image}
          land
          float={hit?.id === player.base.id ? hit : undefined}
          {...stateOf(player.base.id, player.seat)}
          onClick={() => click(player.base.id, () => setInspect({ code: player.base.code }))}
          onInspect={() => setInspect({ code: player.base.code })}
        >
          {upgradeTabs(player.base.upgrades ?? [])}
        </CardView>
        <div
          className="swu-life"
          role="img"
          aria-label={`${ts("baseOf", { name: player.name })} : ${ts("life", { left, total: player.base.hp })}`}
        >
          <span style={{ width: `${(left / Math.max(1, player.base.hp)) * 100}%` }} />
          <b>{ts("life", { left, total: player.base.hp })}</b>
        </div>
      </div>
    );
  };

  const leaderOf = (player: SwuPlayer) => {
    const leader = player.leader;
    const card = cards[leader.code];
    const choices = player.seat === me && sel === null ? (bySubject.get(leader.id) ?? []) : [];
    // Déployé, le leader est dans une arène (ou sur un Véhicule) : son emplacement garde sa carte, éteinte.
    const away = leader.deployed;
    return (
      <div className="swu-mid">
        <CardView
          name={card?.name ?? leader.name}
          image={card?.image}
          land
          exhausted={leader.exhausted && !away}
          tag={away ? ts("tag.deployed") : leader.exhausted ? ts("tag.exhausted") : undefined}
          {...(away ? { dim: true } : stateOf(leader.id, player.seat))}
          onClick={() =>
            away ? setInspect({ code: leader.code }) : click(leader.id, () => setInspect({ code: leader.code }))
          }
          onInspect={() => setInspect({ code: leader.code })}
        />
        {choices.length > 0 && !away && (
          <div className="swu-lead-act">
            {choices.map((choice, index) => (
              <button
                key={index}
                type="button"
                className="swu-btn"
                data-size="sm"
                data-kind={choice.deploy ? "gold" : undefined}
                title={label(choice)}
                onClick={() => act(choice.action)}
              >
                {choice.deploy
                  ? ts(choice.label.includes("Pilot") ? "leader.deployPilot" : "leader.deploy")
                  : ts("leader.action")}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const initiative = (player: SwuPlayer) =>
    view.initiative === player.seat ? (
      <span className="swu-init" data-taken={view.initiative_taken || undefined}>
        ★ {ts(view.initiative_taken ? "initiativeTaken" : "initiative")}
      </span>
    ) : null;

  const band = (player: SwuPlayer) => {
    const own = player.seat === me;
    const stat = (name: string, value: ReactNode) => (
      <span className="swu-stat">
        <i>{name}</i>
        {value}
      </span>
    );
    const resources = (
      <>
        <i>{ts("stat.resources")}</i>
        {ts("stat.resourcesValue", { ready: player.resources_ready, total: player.resources })}
        <span className="swu-pips" aria-hidden>
          {Array.from({ length: Math.min(player.resources, 20) }, (_, index) => (
            <span key={index} className="swu-pip" data-off={index >= player.resources_ready || undefined} />
          ))}
        </span>
      </>
    );
    return (
      <div
        className="swu-band"
        data-active={view.to_act === player.seat || undefined}
        style={{ "--who": own ? "var(--swu-me)" : "var(--swu-other)" } as CSSProperties}
      >
        <span className="swu-name">
          {player.name}
          {own && !watching ? ` (${t("player.you")})` : ""}
        </span>
        {(feed.away ?? []).includes(player.seat) && <span className="pt-warn">{t("player.away")}</span>}
        {stat(ts("stat.hand"), player.hand_count)}
        {stat(ts("stat.deck"), player.deck_count)}
        <button type="button" className="swu-stat" onClick={() => setPile({ kind: "discard", seat: player.seat })}>
          <i>{ts("stat.discard")}</i>
          {player.discard.length}
        </button>
        {player.resource_cards ? (
          <button type="button" className="swu-stat" onClick={() => setPile({ kind: "resources", seat: player.seat })}>
            {resources}
          </button>
        ) : (
          <span className="swu-stat">{resources}</span>
        )}
        {player.credits > 0 && stat(ts("stat.credits"), player.credits)}
        {player.force && stat(ts("stat.force"), "✦")}
      </div>
    );
  };

  const handCard = (card: SwuCardRef, index: number, count: number, interactive: boolean) => {
    const info = cards[card.code];
    const choices = interactive ? bySubject.get(card.id) : undefined;
    const playable = Boolean(choices);
    const cost = card.cost ?? info?.cost;
    return (
      <CardView
        key={card.id}
        name={info?.name ?? card.name}
        image={info?.image}
        land={info ? isLandscape(info.kind) : false}
        style={{ "--fan": index - (count - 1) / 2 } as CSSProperties}
        sel={sel === card.id}
        can={interactive && sel === null && playable}
        tgt={sel !== null && targets.has(card.id)}
        no={interactive && prompt?.kind === "turn" && !playable}
        cost={
          cost !== undefined && info
            ? { value: cost, more: cost > info.cost, less: cost < info.cost, label: ts("cost", { cost }) }
            : undefined
        }
        onClick={() =>
          interactive ? click(card.id, () => setInspect({ code: card.code })) : setInspect({ code: card.code })
        }
        onInspect={() => setInspect({ code: card.code })}
      />
    );
  };

  // ---- La question ----
  const trayChoices = loose.filter((choice) => choice.card && subjectOf(choice.action) !== null);
  const buttonChoices = loose.filter((choice) => !trayChoices.includes(choice));
  const needle = filter.trim().toLowerCase();
  const manyButtons = buttonChoices.length > 10;
  const shownButtons = (
    manyButtons && needle ? buttonChoices.filter((choice) => label(choice).toLowerCase().includes(needle)) : buttonChoices
  ).slice(0, manyButtons ? 30 : 10);
  const buttonKind = (choice: SwuChoice) =>
    choice.action.type === "take_initiative"
      ? "gold"
      : choice.action.type === "yes" || choice.action.type === "keep" || choice.deploy
        ? "primary"
        : undefined;
  const acting = view.to_act !== null ? view.players.find((player) => player.seat === view.to_act) : undefined;
  const selCode = sel !== null ? codes.get(sel) : undefined;
  const winners = result?.winners ?? [];

  const toldLine = telling && (
    <span className="swu-told">
      <span>{rich(telling.text, telling.codes)}</span>
    </span>
  );

  const ask = result ? (
    <div className="swu-result" role="status">
      <b>
        {winners.length === 0
          ? t("result.draw")
          : !watching && winners.includes(me)
            ? t("result.won")
            : t("result.winner", {
                names: winners.map((seat) => view.players.find((player) => player.seat === seat)?.name).join(", "),
              })}
      </b>
      {result.reason && <span className="swu-told">{result.reason}</span>}
      {afterResult}
    </div>
  ) : (
    <div className="swu-ask" role="region" aria-live="polite">
      {feed.status === "reconnecting" && (
        <small className="pt-warn pt-row">
          <WifiOffIcon size={14} />
          {t("status.reconnecting")}
        </small>
      )}
      {layout === "portrait" && toldLine}
      {sel !== null ? (
        <>
          <button
            type="button"
            className="swu-cardname"
            onClick={() => selCode && setInspect({ code: selCode })}
            aria-label={t("card.inspect", { name: cards[selCode ?? ""]?.name ?? "" })}
          >
            <strong>{cards[selCode ?? ""]?.name ?? ""}</strong>
          </button>
          {selButtons.map((choice, index) => (
            <button key={index} type="button" className="swu-btn" data-kind="primary" onClick={() => act(choice.action)}>
              {label(choice)}
            </button>
          ))}
          <button type="button" className="swu-btn" onClick={() => setSelected(null)}>
            {ts("ask.cancel")}
          </button>
          {targets.size > 0 && <small>{ts("ask.pickTarget")}</small>}
        </>
      ) : prompt ? (
        <>
          <strong>{rich(prompt.text, [prompt.card ?? "", ...prompt.choices.flatMap((choice) => choice.card ?? [])])}</strong>
          {manyButtons && (
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t("choices.filter")}
              aria-label={t("choices.filter")}
              className="pt-input"
            />
          )}
          {shownButtons.map((choice, index) => (
            <button
              key={index}
              type="button"
              className="swu-btn"
              data-kind={buttonKind(choice)}
              onClick={() => act(choice.action)}
            >
              {label(choice)}
            </button>
          ))}
          {manyButtons && shownButtons.length === 0 && <small>{t("choices.none")}</small>}
          {trayChoices.length > 0 && (
            <div className="swu-tray">
              {trayChoices.map((choice, index) => {
                const info = cards[choice.card ?? ""];
                return (
                  <CardView
                    key={index}
                    name={label(choice)}
                    image={info?.image}
                    land={info ? isLandscape(info.kind) : false}
                    can
                    onClick={() => act(choice.action)}
                    onInspect={() => choice.card && setInspect({ code: choice.card })}
                  />
                );
              })}
            </div>
          )}
          {prompt.kind === "turn" && <small>{ts("ask.turnHint", { ready: mine.resources_ready })}</small>}
          {bySubject.size > 0 && prompt.kind !== "turn" && <small>{t("prompt.onTable")}</small>}
        </>
      ) : !telling || layout !== "portrait" ? (
        <span className="swu-told">
          {watching
            ? paused
              ? t("watch.paused")
              : t("watch.title")
            : acting
              ? t("prompt.waitingFor", { name: acting.name })
              : t("prompt.waiting")}
        </span>
      ) : null}
      {feed.error && <small className="pt-error">{feed.error}</small>}
    </div>
  );

  const theirHand = theirs.hand ?? [];
  const myHand = mine.hand ?? [];

  const fan = (
    <div className="swu-fan" aria-label={watching ? t("watch.handOf", { name: mine.name }) : t("zone.hand")}>
      {myHand.map((card, index) => handCard(card, index, myHand.length, !watching))}
    </div>
  );
  const scene = (
    <div className="swu-scene">
      {band(theirs)}
      {theirHand.length > 0 && (
        <div className="swu-minihand" aria-label={t("watch.handOf", { name: theirs.name })}>
          {theirHand.map((card, index) => handCard(card, index, 1, false))}
        </div>
      )}
      <div className="swu-stage">
        <div className="swu-board">
          <div className="swu-felt">
            {arena(view.ground, ts("arena.ground"))}
            <div className="swu-center">
              <div className="swu-side">
                {baseOf(theirs)}
                {leaderOf(theirs)}
                {initiative(theirs)}
              </div>
              <div className="swu-side">
                {initiative(mine)}
                {leaderOf(mine)}
                {baseOf(mine)}
              </div>
            </div>
            {arena(view.space, ts("arena.space"))}
          </div>
        </div>
      </div>
      <div className="swu-mine">{band(mine)}</div>
      {layout !== "portrait" && fan}
    </div>
  );

  const roundChip = (
    <span className="pt-turn">
      <b>{ts("round", { round: view.round })}</b>
      <span className="pt-muted">· {ts.has(`phase.${view.phase}`) ? ts(`phase.${view.phase}`) : view.phase}</span>
    </span>
  );
  const quit = (
    <button type="button" className="pt-icon" aria-label={t("table.quit")} onClick={() => navigate(home)}>
      <BackIcon />
    </button>
  );
  const watchControls = watching && feed.step && !result && (
    <>
      <button
        type="button"
        className={cx("pt-icon", paused && "pt-icon--on")}
        aria-pressed={paused}
        aria-label={paused ? t("watch.resume") : t("watch.pause")}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      {paused && (
        <button type="button" className="pt-icon" aria-label={t("watch.step")} onClick={feed.step}>
          <StepIcon />
        </button>
      )}
    </>
  );
  const skipButton = backlog > 1 && (
    <button type="button" className="pt-icon" aria-label={t("pace.skip")} onClick={skip}>
      <FastIcon />
    </button>
  );
  const settingsButton = (
    <button type="button" className="pt-icon" aria-label={t("pace.settings")} onClick={() => setSheet("settings")}>
      <GaugeIcon />
    </button>
  );
  const journal = <Journal entries={feed.journal} empty={t("journal.empty")} render={(entry) => rich(entry.text, entry.codes)} />;

  const strip = (
    <div className="pt-strip">
      <button type="button" className="pt-icon" aria-label={t("panel.open")} onClick={panel.toggle}>
        <BackIcon />
      </button>
      {[theirs, mine].map((player) => {
        const left = Math.max(0, player.base.hp - player.base.damage);
        return (
          <div
            key={player.seat}
            className={cx("pt-strip__player", view.to_act === player.seat && "pt-strip__player--turn")}
            style={{ "--who": player.seat === me ? "#2bb7dc" : "#e0566b" } as CSSProperties}
            title={`${player.name} · ${ts("life", { left, total: player.base.hp })}`}
          >
            <span className="pt-strip__initial">{player.name.slice(0, 2)}</span>
            <b>{left}</b>
            {view.initiative === player.seat && <span className="pt-tiny">★</span>}
          </div>
        );
      })}
      <span className="pt-grow" />
      {backlog > 0 && <span className="pt-strip__left">{backlog}</span>}
      {watchControls}
    </div>
  );

  const panelHead = (
    <div className="pt-panel__head">
      <span className="pt-dot" style={{ background: deciding ? "var(--accent)" : "var(--muted)" }} />
      <span className="pt-grow pt-small" style={{ color: deciding ? "var(--accent)" : "var(--muted)" }}>
        {deciding ? t("panel.yourMove") : panel.pinned ? t("panel.pinned") : t("panel.auto")}
      </span>
      <button type="button" className="pt-icon pt-icon--sm" aria-label={t("panel.fold")} onClick={panel.toggle}>
        <ForwardIcon />
      </button>
    </div>
  );
  const narration = (
    <div className="pt-narration" aria-live="polite">
      <p className={cx("pt-narration__text", !telling && "pt-muted")}>
        {telling ? rich(telling.text, telling.codes) : t("journal.empty")}
      </p>
      {backlog > 1 && <span className="pt-narration__left">{t("pace.remaining", { count: backlog - 1 })}</span>}
    </div>
  );

  const sheets = (
    <>
      {inspect && <InspectSheet inspect={inspect} cards={cards} onClose={() => setInspect(null)} />}
      {pile && (
        <PileSheet
          pile={pile}
          players={view.players}
          cards={cards}
          onClose={() => setPile(null)}
          onCard={(code) => setInspect({ code })}
        />
      )}
      {sheet === "journal" && (
        <Sheet title={t("journal.title")} onClose={() => setSheet(null)} className="pt-sheet--tall">
          {journal}
        </Sheet>
      )}
      {sheet === "settings" && (
        <Sheet title={t("pace.settings")} onClose={() => setSheet(null)}>
          <Settings
            speed={speed}
            onSpeed={setSpeed}
            onConcede={!watching && !result ? () => act({ type: "concede" }) : undefined}
            onClose={() => setSheet(null)}
          />
          {note && <p className="pt-muted pt-small">{note}</p>}
        </Sheet>
      )}
    </>
  );

  if (layout === "portrait") {
    return (
      <div className="pt pt--portrait swu-table">
        <header className="pt-bar" data-play-bar>
          {quit}
          {roundChip}
          <span className="pt-grow" />
          {watchControls}
          {skipButton}
          <button type="button" className="pt-icon" aria-label={t("journal.title")} onClick={() => setSheet("journal")}>
            <JournalIcon />
          </button>
          {settingsButton}
        </header>
        <main className="pt-center">{scene}</main>
        <div className="swu-fan-dock">{fan}</div>
        <section className="pt-dock swu-dock">{ask}</section>
        {sheets}
      </div>
    );
  }

  const panelBody = panel.open ? (
    panelJournal && layout === "landscape" ? (
      <>
        <div className="pt-panel__head">
          <b className="pt-grow">{t("journal.title")}</b>
          <button type="button" className="pt-icon pt-icon--sm" aria-label={t("panel.back")} onClick={() => setPanelJournal(false)}>
            <ForwardIcon />
          </button>
        </div>
        {journal}
      </>
    ) : (
      <>
        {panelHead}
        {narration}
        {ask}
        {layout === "tablet" && journal}
      </>
    )
  ) : (
    strip
  );

  if (layout === "landscape") {
    return (
      <div className="pt pt--landscape swu-table">
        <nav className="pt-rail">
          {quit}
          <button
            type="button"
            className={cx("pt-icon", panelJournal && panel.open && "pt-icon--on")}
            aria-label={t("journal.title")}
            onClick={() => {
              if (!panel.open) panel.toggle();
              setPanelJournal((value) => !value || !panel.open);
            }}
          >
            <JournalIcon />
          </button>
          {settingsButton}
          {skipButton}
          <span className="pt-grow" />
          <div className="pt-rail__turn">
            {ts("roundShort")}
            <b>{view.round}</b>
          </div>
        </nav>
        <main className="pt-center">{scene}</main>
        <aside className={cx("pt-panel", !panel.open && "pt-panel--folded")}>{panelBody}</aside>
        {sheets}
      </div>
    );
  }

  return (
    <div className="pt pt--tablet swu-table">
      <header className="pt-bar" data-play-bar>
        {quit}
        <div className="pt-bar__game">
          <b>Star Wars: Unlimited</b>
        </div>
        {roundChip}
        <span className="pt-grow" />
        {watchControls}
        {skipButton}
        {settingsButton}
      </header>
      <div className="pt-tablet-body">
        <main className="pt-center">{scene}</main>
        <aside className={cx("pt-panel", !panel.open && "pt-panel--folded")}>{panelBody}</aside>
      </div>
      {sheets}
    </div>
  );
}

function Settings({
  speed,
  onSpeed,
  onConcede,
  onClose,
}: {
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  onConcede?: () => void;
  onClose: () => void;
}) {
  const t = usePlayT("Play");
  const [conceding, setConceding] = useState(false);
  return (
    <div className="pt-settings">
      <div className="segmented" role="group" aria-label={t("pace.settings")}>
        {(Object.keys(SPEEDS) as Speed[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            className={cx("segmented__item", speed === value && "segmented__item--active")}
            onClick={() => onSpeed(value)}
          >
            {t(`pace.speed.${value}`)}
          </button>
        ))}
      </div>
      {onConcede &&
        (conceding ? (
          <div className="pt-row-wrap">
            <span>{t("concede.confirm")}</span>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onClose();
                onConcede();
              }}
            >
              {t("concede.yes")}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setConceding(false)}>
              {t("concede.no")}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost pt-concede" onClick={() => setConceding(true)}>
            <FlagIcon size={16} />
            {t("concede.action")}
          </button>
        ))}
    </div>
  );
}

type CardViewProps = {
  name: string;
  image?: string;
  land?: boolean;
  exhausted?: boolean;
  tag?: string;
  power?: number;
  hp?: number;
  damage?: number;
  keywords?: { label: string }[];
  /** Une précision sous la carte (cartes capturées). */
  note?: string;
  cost?: { value: number; more: boolean; less: boolean; label: string };
  float?: { key: number; amount: number };
  sel?: boolean;
  can?: boolean;
  tgt?: boolean;
  dim?: boolean;
  focus?: boolean;
  no?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  onInspect?: () => void;
  /** Les améliorations, en onglets au-dessus de la carte. */
  children?: ReactNode;
};

/** Au doigt, un appui long montre la carte en grand. */
const LONG_PRESS_MS = 450;

/** Une carte sur la table : son image, ses chiffres du moment, et l'état que la question lui donne. */
function CardView({
  name,
  image,
  land = false,
  exhausted = false,
  tag,
  power,
  hp,
  damage = 0,
  keywords = [],
  note,
  cost,
  float,
  sel,
  can,
  tgt,
  dim,
  focus,
  no,
  style,
  onClick,
  onInspect,
  children,
}: CardViewProps) {
  const flag = (value: boolean | undefined) => (value ? true : undefined);
  // Une image qui ne se charge pas laisse la place au nom de la carte.
  const [broken, setBroken] = useState<string | null>(null);
  const press = useRef<{ timer: number; x: number; y: number; long: boolean } | null>(null);
  const clear = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };
  return (
    <div
      className="swu-c"
      data-land={flag(land)}
      data-exh={flag(exhausted)}
      data-sel={flag(sel)}
      data-can={flag(can && !sel)}
      data-tgt={flag(tgt && !sel)}
      data-dim={flag(dim && !sel && !tgt)}
      data-focus={flag(focus && !sel && !tgt && !can)}
      data-no={flag(no && !sel)}
      style={style}
    >
      {children}
      <button
        type="button"
        className="swu-face"
        title={name}
        aria-label={name}
        aria-pressed={sel || undefined}
        onPointerDown={(event) => {
          clear();
          if (!onInspect || event.pointerType !== "touch") return;
          const state = { timer: 0, x: event.clientX, y: event.clientY, long: false };
          state.timer = window.setTimeout(() => {
            state.long = true;
            navigator.vibrate?.(10);
            onInspect();
          }, LONG_PRESS_MS);
          press.current = state;
        }}
        onPointerMove={(event) => {
          const p = press.current;
          if (p && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 10) clear();
        }}
        onPointerUp={clear}
        onPointerCancel={clear}
        onClick={() => {
          // Après un appui long, le toucher qui suit ne joue pas la carte.
          if (press.current?.long) {
            press.current = null;
            return;
          }
          press.current = null;
          onClick?.();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!onInspect || press.current?.long) return;
          onInspect();
        }}
      >
        {image && broken !== image ? (
          <img src={image} alt="" loading="lazy" draggable={false} onError={() => setBroken(image)} />
        ) : (
          <span>{name}</span>
        )}
      </button>
      {tag && <span className="swu-tag">{tag}</span>}
      {keywords.length > 0 && (
        <span className="swu-kws">
          {keywords.map((keyword) => (
            <span key={keyword.label} className="swu-kw">
              {keyword.label}
            </span>
          ))}
        </span>
      )}
      {cost && (
        <span className="swu-cost" data-more={flag(cost.more)} data-less={flag(cost.less)} title={cost.label}>
          {cost.value}
        </span>
      )}
      {damage > 0 && <span className="swu-dmg">−{damage}</span>}
      {power !== undefined && <span className="swu-pw">{power}</span>}
      {hp !== undefined && (
        <span className="swu-hp" data-hurt={flag(damage > 0)}>
          {hp}
        </span>
      )}
      {note && (
        <span className="swu-tag" style={{ top: "auto", bottom: 22 }}>
          {note}
        </span>
      )}
      {float && (
        <span key={float.key} className="swu-float play-float" aria-hidden>
          −{float.amount}
        </span>
      )}
    </div>
  );
}

/** Une phrase du moteur : noms de cartes en français et touchables, noms des joueurs à leur couleur. */
function Rich({
  text,
  codes,
  cards,
  names,
  me,
  onCard,
}: {
  text: string;
  codes: Iterable<string>;
  cards: SwuTableCards;
  names: string[];
  me: string;
  onCard: (code: string) => void;
}) {
  const parts = localizeSwuText(text, codes, cards);
  const known = names.filter(Boolean).sort((a, b) => b.length - a.length);
  const pattern =
    known.length > 0
      ? new RegExp(`(${known.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g")
      : null;
  return (
    <>
      {parts.map((part, index) =>
        part.card ? (
          <button
            key={index}
            type="button"
            className="swu-cardname"
            onClick={(event) => {
              event.stopPropagation();
              onCard(part.card ?? "");
            }}
          >
            {part.text}
          </button>
        ) : pattern ? (
          part.text.split(pattern).map((piece, inner) =>
            known.includes(piece) ? (
              <span key={`${index}-${inner}`} className={piece === me ? "swu-who-me" : "swu-who-other"}>
                {piece}
              </span>
            ) : (
              piece
            ),
          )
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/** Le récit de la partie, round après round ; il suit la dernière ligne. */
function Journal({
  entries,
  empty,
  render,
}: {
  entries: SwuJournalEntry[];
  empty: string;
  render: (entry: SwuJournalEntry) => ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = list.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [entries.length]);
  return (
    <div className="swu-log pt-journal">
      <div ref={list} className="swu-log-list">
        {entries.length === 0 && <p>{empty}</p>}
        {entries.map((entry) =>
          entry.event.type === "round_started" || entry.event.type === "phase_started" ? (
            <h4 key={entry.key}>{entry.text.replace(/\.$/, "")}</h4>
          ) : (
            <p key={entry.key}>
              {render(entry)}
              {entry.rule ? <span className="swu-rule"> {entry.rule}</span> : null}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

/** Une carte en grand, avec son texte et, pour une unité en jeu, ses chiffres du moment. */
function InspectSheet({ inspect, cards, onClose }: { inspect: Inspect; cards: SwuTableCards; onClose: () => void }) {
  const ts = usePlayT("PlaySwu");
  const card: SwuTableCard | undefined = cards[inspect.code];
  const unit = inspect.unit;
  const land = card ? isLandscape(card.kind) : false;
  return (
    <Sheet title={card?.name ?? inspect.code} onClose={onClose}>
      <div className="pt-inspect">
        {card?.image && <img src={card.image} alt="" className={cx("pt-inspect__img", land && "pt-inspect__img--land")} />}
        <div className="pt-inspect__text">
          {card?.back && <img src={card.back} alt={ts("inspect.unitSide")} className="swu-back-img" />}
          {unit && (
            <dl className="swu-dl">
              <dt>{ts("inspect.power")}</dt>
              <dd>{unit.power}</dd>
              <dt>{ts("inspect.hp")}</dt>
              <dd>
                {unit.hp}
                {unit.damage > 0 ? ` (${ts("inspect.damage", { damage: unit.damage })})` : ""}
              </dd>
              {unit.keywords.length > 0 && (
                <>
                  <dt>{ts("inspect.keywords")}</dt>
                  <dd>
                    {unit.keywords
                      .map(keywordName)
                      .map((keyword) =>
                        ts.has(`kw.${keyword.key}`) ? ts(`kw.${keyword.key}`, { n: keyword.n ?? 0 }) : keyword.key,
                      )
                      .join(", ")}
                  </dd>
                </>
              )}
              {unit.upgrades.length > 0 && (
                <>
                  <dt>{ts("inspect.upgrades")}</dt>
                  <dd>{unit.upgrades.map((upgrade) => cards[upgrade.code]?.title ?? upgrade.name).join(", ")}</dd>
                </>
              )}
              {unit.captives.length > 0 && (
                <>
                  <dt>{ts("inspect.captives")}</dt>
                  <dd>{unit.captives.map((captive) => cards[captive.code]?.title ?? captive.name).join(", ")}</dd>
                </>
              )}
            </dl>
          )}
          {card?.text && <p className="pt-pre pt-muted">{card.text}</p>}
          {card && !card.playable && <p className="pt-error">{ts("inspect.unsupported")}</p>}
        </div>
      </div>
    </Sheet>
  );
}

/** Une pile consultable : la défausse d'un joueur, ou mes ressources. */
function PileSheet({
  pile,
  players,
  cards,
  onClose,
  onCard,
}: {
  pile: Pile;
  players: SwuPlayer[];
  cards: SwuTableCards;
  onClose: () => void;
  onCard: (code: string) => void;
}) {
  const ts = usePlayT("PlaySwu");
  const player = players.find((candidate) => candidate.seat === pile.seat);
  const list = !player ? [] : pile.kind === "discard" ? player.discard : (player.resource_cards ?? []);
  const title = !player ? "" : ts(pile.kind === "discard" ? "pile.discardOf" : "pile.resourcesOf", { name: player.name });
  return (
    <Sheet title={title} onClose={onClose}>
      {list.length === 0 ? (
        <p className="pt-muted pt-small">{ts("pile.empty")}</p>
      ) : (
        <div className="swu-table swu-pile">
          {list.map((card) => {
            const info = cards[card.code];
            return (
              <CardView
                key={card.id}
                name={info?.name ?? card.name}
                image={info?.image}
                land={info ? isLandscape(info.kind) : false}
                onClick={() => onCard(card.code)}
              />
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
