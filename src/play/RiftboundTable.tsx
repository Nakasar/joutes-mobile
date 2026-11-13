import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { mulliganChoice, mulliganLimit, sortChoices } from "../engine/anchors";
import type { TableCard, TableCards } from "../engine/cards";
import {
  abilityKey,
  coverage,
  locKey,
  nextRuneUse,
  payAction,
  proposedChoice,
  sameLoc,
  type PayChoice,
  type RuneUse,
} from "../engine/payment";
import {
  actorOf,
  battlefieldOf,
  codeOf,
  combatInFocus,
  damageOf,
  eventType,
  objectsOf,
  PACE_SPEEDS,
  revealsCard,
  TABLE_VIEWS,
  type Ack,
} from "../engine/pacing";
import { DOMAIN_HEX, playerColor, toldIndex } from "../engine/told-text";
import type {
  EngineAction,
  EngineBattlefield,
  EngineChoice,
  EngineLoc,
  EngineObj,
  EnginePlayHint,
  EnginePlayer,
  EngineTold,
  EngineView,
} from "../engine/types";
import type { GameFeed } from "./game-feed";
import { CostChips, DragGhost, HandCard, RUNE_MARK, type DragStart } from "./HandPlay";
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
  TrashIcon,
  WifiOffIcon,
} from "./icons";
import { PaymentPanel } from "./PaymentPanel";
import { PlayCard, type CardSize } from "./PlayCard";
import { usePlayT, type PlayT } from "./t";
import { TableFx } from "./TableFx";
import { HandFan, PointRails, TableScene } from "./TableScene";
import { ToldText } from "./ToldText";
import { Sheet, Toggle, useSidePanel, useTableLayout, type TableLayout } from "./ui";
import { usePacedFeed, type Ghost, type PacedFeed } from "./usePacedFeed";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Ordre des domaines dans `pool.power`, celui du moteur. */
const DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"] as const;

type Inspected = { obj?: EngineObj; card?: TableCard; playable?: boolean };

/** La carte que le joueur est en train de jouer : posée quelque part, ou en attente d'un emplacement. */
type Intent = { card: number; loc: EngineLoc | null; armed: boolean; sent: boolean };

/** L'état d'un emplacement pendant qu'on joue une carte. */
type DropState = { key: string; state: "ok" | "hot" | "off" | null; onPick?: (event: { clientX: number; clientY: number }) => void };

/** Le nom d'une question : `"pay"`, `"play_location"`, `"priority"`… */
function kindName(kind: unknown): string | null {
  if (typeof kind === "string") return kind;
  if (kind && typeof kind === "object") return Object.keys(kind)[0] ?? null;
  return null;
}

function keyLoc(key: string): EngineLoc | null {
  const [zone, n] = key.split(":");
  if (zone === "base") return { Base: Number(n) };
  if (zone === "bf") return { Bf: Number(n) };
  return null;
}

/** Une ligne du journal sans ses tirets de mise en forme (« — Tour 4 : Robot — »). */
function plain(text: string | null | undefined): string {
  return (text ?? "").trim().replace(/^—\s*|\s*—$/g, "");
}

type RiftboundTableProps = {
  feed: GameFeed;
  cards: TableCards;
  /** L'accueil du mode Jouer, où mène « Quitter ». */
  home: string;
  /** Ce qui suit le résultat : rejouer, revenir à l'accueil… */
  afterResult?: ReactNode;
  /** Une précision sous le nom du jeu (le serveur d'une partie hébergée). */
  note?: string;
  /** Une partie entre IA regardée en spectateur : pause, pas à pas, et le choix de voir les mains. */
  watch?: { hands: boolean; onHands: (hands: boolean) => void };
};

/**
 * La table de Riftbound, portée du site (`components/play/GameTable.tsx`) :
 * même moteur, même récit pas à pas, mêmes réglages. Elle ne connaît aucune
 * règle : elle dessine ce que le moteur montre, pose la question qu'il pose et
 * lui renvoie l'une des actions qu'il propose.
 *
 * Trois mises en page : téléphone à la verticale (le récit en haut, la question
 * en bas), à l'horizontale (rail d'icônes, plateau, panneau à droite) et
 * tablette (plateau en relief, panneau à droite). Le panneau latéral se replie
 * en une bande étroite et se déplie seul quand une décision attend.
 */
export function RiftboundTable({ feed, cards, home, afterResult, note, watch }: RiftboundTableProps) {
  const t = usePlayT("Play");
  const navigate = useNavigate();
  const layout = useTableLayout();
  const paced = usePacedFeed(feed);
  const { update, journal } = paced;
  const hold = feed.hold;
  useEffect(() => {
    hold?.(paced.busy || paced.paused);
  }, [hold, paced.busy, paced.paused]);

  const [inspected, setInspected] = useState<Inspected | null>(null);
  const [trashOf, setTrashOf] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"journal" | "settings" | null>(null);
  // À l'horizontale, le journal prend la place du panneau.
  const [panelJournal, setPanelJournal] = useState(false);
  // À l'horizontale, la main dépasse en bas du plateau ; la toucher la relève.
  const [handUp, setHandUp] = useState(false);
  const [mulliganState, setMulliganState] = useState<{ key: string; ids: number[] }>({ key: "", ids: [] });

  const view = update?.view ?? null;
  const prompt = update?.prompt ?? null;
  const me = feed.seat ?? 0;
  const spectator = feed.seat === null;

  const sorted = useMemo(() => (view && prompt ? sortChoices(prompt.choices, view) : null), [view, prompt]);

  const playerKey = view ? JSON.stringify(view.players.map((player) => [player.seat, player.name])) : "[]";
  const names = useMemo(() => {
    const players = (JSON.parse(playerKey) as [number, string][]).map(([seat, name]) => ({ seat, name }));
    return toldIndex(players, Object.values(cards));
  }, [playerKey, cards]);

  const promptKey = update ? `${update.seq}:${prompt?.text ?? ""}` : "";
  const mulligan = mulliganState.key === promptKey ? mulliganState.ids : [];

  // ---- Jouer une carte : glisser-déposer, bouton Jouer, paiement.
  const [intent, setIntent] = useState<Intent | null>(null);
  const [drag, setDrag] = useState<{ card: number; x: number; y: number; target: string | null } | null>(null);
  const [dropMenu, setDropMenu] = useState<{ card: number; bf: number; x: number; y: number } | null>(null);
  const [payState, setPayState] = useState<{ key: string; custom: boolean; choice: PayChoice } | null>(null);
  const asking = kindName(prompt?.kind);
  const payment = asking === "pay" ? (prompt?.payment ?? null) : null;
  const plays = prompt?.plays ?? [];
  const hintOf = (card: number) => plays.find((hint) => hint.card === card);
  const act = (action: EngineAction) => feed.act(action);
  const choicesFor = (id: number) => (prompt?.choices ?? []).filter((choice) => choice.action.card === id);
  const playChoiceOf = (card: number) => choicesFor(card).find((choice) => choice.action.type === "play");
  const hideChoicesOf = (card: number) => choicesFor(card).filter((choice) => choice.action.type === "hide");
  /** Où l'on peut poser cette carte : des clés d'emplacement, ou « any » pour un sort. */
  const dropKeysOf = (card: number): string[] => {
    const hint = hintOf(card);
    const hides = hideChoicesOf(card).map((choice) => `bf:${choice.action.bf as number}`);
    if (!playChoiceOf(card)) return hides;
    if (!hint) return ["any"];
    if (hint.locs.length === 0) return ["any"];
    return [...new Set([...hint.locs.map(locKey), ...hides])];
  };

  const playCard = (card: number, loc: EngineLoc | null) => {
    const choice = playChoiceOf(card);
    setDropMenu(null);
    if (!choice) return;
    setIntent({ card, loc, armed: false, sent: true });
    act(choice.action);
  };
  const dropOn = (card: number, key: string, at: { clientX: number; clientY: number }) => {
    if (key === "any") return playCard(card, null);
    const loc = keyLoc(key);
    if (!loc) return;
    const hide = "Bf" in loc ? hideChoicesOf(card).find((choice) => choice.action.bf === loc.Bf) : undefined;
    const canPlay = Boolean(playChoiceOf(card)) && (hintOf(card)?.locs ?? [loc]).some((l) => sameLoc(l, loc));
    if (hide && canPlay && "Bf" in loc) {
      setIntent(null);
      setDropMenu({ card, bf: loc.Bf, x: at.clientX, y: at.clientY });
    } else if (hide) {
      setIntent(null);
      act(hide.action);
    } else if (canPlay) {
      playCard(card, loc);
    }
  };
  /** Le bouton Jouer : tout de suite s'il n'y a qu'un endroit possible, sinon on attend un toucher. */
  const playButton = (card: number) => {
    const keys = dropKeysOf(card);
    if (keys.length === 1 && hideChoicesOf(card).length === 0) {
      return playCard(card, keys[0] === "any" ? null : keyLoc(keys[0]));
    }
    if (keys.length > 0) {
      setHandUp(false);
      setIntent({ card, loc: null, armed: true, sent: false });
    }
  };
  const beginDrag = (start: DragStart) => {
    setIntent(null);
    setDropMenu(null);
    setHandUp(false);
    setDrag({ card: start.card, x: start.x, y: start.y, target: null });
  };

  // Pendant le glisser, la carte suit le doigt ; lâchée sur un emplacement permis, elle s'y joue.
  const dragging = drag !== null;
  const dropRef = useRef({ dropKeysOf, dropOn });
  const dragRef = useRef(drag);
  useEffect(() => {
    dropRef.current = { dropKeysOf, dropOn };
    dragRef.current = drag;
  });
  useEffect(() => {
    if (!dragging) return;
    const targetAt = (x: number, y: number, card: number): string | null => {
      const keys = dropRef.current.dropKeysOf(card);
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
      if (zone && keys.includes(zone)) return zone;
      if (keys.includes("any") && el?.closest("[data-play-table]")) return "any";
      return null;
    };
    const move = (event: PointerEvent) => {
      event.preventDefault();
      setDrag((current) =>
        current
          ? { ...current, x: event.clientX, y: event.clientY, target: targetAt(event.clientX, event.clientY, current.card) }
          : current,
      );
    };
    const up = (event: PointerEvent) => {
      const current = dragRef.current;
      setDrag(null);
      const target = current ? targetAt(event.clientX, event.clientY, current.card) : null;
      if (current && target) dropRef.current.dropOn(current.card, target, event);
    };
    const cancel = () => setDrag(null);
    // Le doigt qui glisse ne doit pas faire défiler la page dessous.
    const block = (event: TouchEvent) => event.preventDefault();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", block);
    };
  }, [dragging]);

  // Le moteur demande où va la carte qu'on vient de poser : on répond pour le joueur.
  const answered = useRef("");
  useEffect(() => {
    if (!prompt || answered.current === promptKey) return;
    if (intent?.sent && asking === "play_location" && intent.loc) {
      const choice = prompt.choices.find(
        (c) => c.action.type === "pick_loc" && sameLoc(c.action.loc as EngineLoc, intent.loc),
      );
      if (choice) {
        answered.current = promptKey;
        act(choice.action);
        return;
      }
    }
    // De retour à la question de priorité : la carte est jouée (ou la déclaration annulée).
    if (intent?.sent && asking === "priority") setIntent(null);
    // « Payer sans confirmer » : la proposition du moteur part aussitôt.
    if (asking === "pay" && paced.pace.autoPay && prompt.choices[0]?.action.type === "pay") {
      answered.current = promptKey;
      act(prompt.choices[0].action);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptKey]);

  // Le paiement en cours : la proposition du moteur, ou celle que le joueur compose.
  const pay = payment
    ? payState?.key === promptKey
      ? payState
      : { key: promptKey, custom: false, choice: proposedChoice(payment) }
    : null;
  const setPay = (next: { custom: boolean; choice: PayChoice }) => setPayState({ key: promptKey, ...next });
  const confirmPay = () => {
    if (!pay) return;
    const proposed = prompt?.choices.find((choice) => choice.action.type === "pay");
    act(pay.custom || !proposed ? payAction(pay.choice) : proposed.action);
  };

  // Une décision attend ce joueur : le panneau latéral se déplie.
  const deciding =
    !spectator && view !== null && !view.result && (paced.ack !== null || (prompt !== null && prompt.choices.length > 0));
  const decision = deciding ? (paced.ack ? `ack:${paced.ack.at}` : promptKey) : null;
  const panel = useSidePanel(layout === "portrait" ? null : decision);

  if (!view) {
    return (
      <div className="pt pt--empty">
        <p className="pt-muted">{feed.status === "error" ? (feed.error ?? t("status.error")) : t("status.loading")}</p>
        <button type="button" className="btn btn--outline" onClick={() => navigate(home)}>
          {t("table.quit")}
        </button>
      </div>
    );
  }

  const cardOf = (obj: EngineObj | undefined | null): TableCard | undefined => (obj?.code ? cards[obj.code] : undefined);
  const choicesOn = (key: string): EngineChoice[] => sorted?.anchored.get(key) ?? [];
  const choosingOnTable = (sorted?.anchored.size ?? 0) > 0;
  const mulliganing = (sorted?.mulligan.length ?? 0) > 0;
  const mulliganMax = sorted ? mulliganLimit(sorted.mulligan) : 0;

  // Ce que l'évènement raconté concerne : entouré, touché, ou au centre de la table.
  const step = paced.current;
  const focusObjs = new Set(step ? objectsOf(step.entry) : []);
  const focusBf = step ? battlefieldOf(step.entry) : null;
  const hits = step ? damageOf(step.entry) : new Map<number, number>();
  const actor = step ? actorOf(step.entry) : null;
  const scoring =
    step && (eventType(step.entry) === "scored" || eventType(step.entry) === "points")
      ? view.players
          .filter((player) =>
            eventType(step.entry) === "points" ? player.team === step.entry.event.team : player.seat === actor,
          )
          .map((player) => player.seat)
      : [];

  // Paiement personnalisé : un Seal ou un Or se choisit aussi d'un toucher sur la table.
  const payAbilitiesOf = (id: number) =>
    pay?.custom ? (payment?.abilities ?? []).filter((ability) => ability.source === id) : [];
  const cycleAbility = (id: number) => {
    if (!pay) return;
    const keys = payAbilitiesOf(id).map(abilityKey);
    const at = keys.findIndex((key) => pay.choice.abilities.includes(key));
    const next = keys[at + 1];
    const abilities = [...pay.choice.abilities.filter((key) => !keys.includes(key)), ...(next ? [next] : [])];
    setPay({ custom: true, choice: { ...pay.choice, abilities } });
  };
  const toggleAbility = (key: string) => {
    if (!pay) return;
    const source = key.split(":")[0];
    const abilities = pay.choice.abilities.includes(key)
      ? pay.choice.abilities.filter((k) => k !== key)
      : [...pay.choice.abilities.filter((k) => k.split(":")[0] !== source), key];
    setPay({ custom: true, choice: { ...pay.choice, abilities } });
  };
  const renderObj = (obj: EngineObj, size: CardSize = "md") => {
    const sourceKeys = payAbilitiesOf(obj.id).map(abilityKey);
    const source = sourceKeys.length > 0;
    return (
      <PlayCard
        key={obj.id}
        obj={obj}
        card={cardOf(obj)}
        size={size}
        choices={
          source
            ? [{ action: { type: "pay_source" }, label: t("payment.use", { name: cardOf(obj)?.name ?? "" }) }]
            : choicesOn(`obj:${obj.id}`)
        }
        onAct={source ? () => cycleAbility(obj.id) : act}
        onInspect={() => setInspected({ obj, card: cardOf(obj) })}
        dim={choosingOnTable}
        selected={source && sourceKeys.some((key) => pay?.choice.abilities.includes(key))}
        focus={focusObjs.has(obj.id)}
        hit={hits.get(obj.id)}
      />
    );
  };

  // Une carte de la main qu'on peut jouer : aperçu au toucher, appui long pour glisser.
  const handPlayCard = (obj: EngineObj, size: CardSize) => {
    const choices = choicesOn(`obj:${obj.id}`);
    const others = choices.filter((choice) => choice.action.type !== "play" && choice.action.type !== "hide");
    const playable = choices.length > 0 && others.length === 0;
    if (spectator || !playable) return renderObj(obj, size);
    return (
      <HandCard
        key={obj.id}
        obj={obj}
        playable
        armed={intent?.armed === true && intent.card === obj.id}
        onDragStart={beginDrag}
      >
        <PlayCard
          obj={obj}
          card={cardOf(obj)}
          size={size}
          className="pt-card-wrap--playable"
          onInspect={() => setInspected({ obj, card: cardOf(obj), playable: true })}
          focus={focusObjs.has(obj.id)}
        />
      </HandCard>
    );
  };

  // Les runes que le paiement utiliserait : pendant le paiement, ou pendant qu'on pose une carte.
  const previewCard = drag?.card ?? (intent?.armed ? intent.card : null);
  const previewHint = previewCard !== null && previewCard !== undefined ? hintOf(previewCard) : undefined;
  const runeMarks: Record<number, RuneUse> = pay ? pay.choice.runes : previewHint ? proposedChoice(previewHint).runes : {};
  const onRune = pay?.custom
    ? (id: number) => {
        const obj = view.bases[me].find((o) => o.id === id);
        const use = nextRuneUse(pay.choice.runes[id] ?? "none", obj?.exhausted === true);
        setPay({ custom: true, choice: { ...pay.choice, runes: { ...pay.choice.runes, [id]: use } } });
      }
    : undefined;

  // L'état de chaque emplacement pendant qu'on joue une carte.
  const placing = drag?.card ?? (intent?.armed ? intent.card : null);
  const placeKeys = placing !== null ? dropKeysOf(placing) : [];
  const dropOf = (key: string): DropState => {
    if (placing === null || placeKeys.includes("any")) return { key, state: null };
    if (!placeKeys.includes(key)) return { key, state: "off" };
    if (drag) return { key, state: drag.target === key ? "hot" : "ok" };
    return { key, state: "ok", onPick: (event) => dropOn(placing, key, event) };
  };
  const anywhere = drag !== null && placeKeys.includes("any");

  const renderGhost = (ghost: Ghost, size: "sm" | "md" = "md") => (
    <PlayCard
      key={`ghost-${ghost.obj.id}`}
      obj={ghost.obj}
      card={cardOf(ghost.obj)}
      size={size}
      dying={ghost.dying}
      focus={focusObjs.has(ghost.obj.id)}
    />
  );
  const ghostsAt = (place: "base" | "bf", index: number) =>
    paced.ghosts.filter((ghost) =>
      place === "base" ? "base" in ghost.place && ghost.place.base === index : "bf" in ghost.place && ghost.place.bf === index,
    );

  const isRune = (obj: EngineObj) => cardOf(obj)?.kind === "rune";
  const others = view.players.filter((player) => player.seat !== me);
  const mine = view.players[me];
  const myHand = spectator ? [] : (mine.hand ?? []);
  const placingObj =
    placing !== null ? [...myHand, ...(mine.champion ? [mine.champion] : [])].find((o) => o.id === placing) : undefined;
  const waitingFor = view.pending && view.pending.seat !== feed.seat ? view.players[view.pending.seat] : null;

  // En relief (tablette seulement), la caméra s'approche du combat raconté.
  const relief = layout === "tablet" && paced.pace.view === "3d";
  const dive =
    relief && paced.pace.camera && paced.pace.speed !== "instant" && (paced.busy || paced.ack?.kind === "combat")
      ? combatInFocus(paced.journal, paced.current ?? { index: paced.journal.length - 1 }, paced.ack)
      : null;

  const seats = view.players.map((player) => player.seat);
  const colorOf = (seat: number) => playerColor(seat, spectator ? null : me, seats);
  const told = (text: string) => (
    <ToldText text={text} index={names} cards={cards} colorOf={colorOf} onInspect={(card) => setInspected({ card })} />
  );

  const toggleMulligan = (id: number) =>
    setMulliganState({
      key: promptKey,
      ids: mulligan.includes(id)
        ? mulligan.filter((value) => value !== id)
        : mulligan.length < mulliganMax
          ? [...mulligan, id]
          : mulligan,
    });

  const handSize: CardSize = layout === "tablet" ? "lg" : "md";
  const handCard = (obj: EngineObj) =>
    mulliganing ? (
      <PlayCard
        key={obj.id}
        obj={obj}
        card={cardOf(obj)}
        size={handSize}
        choices={[{ action: { type: "mulligan" }, label: cardOf(obj)?.name ?? obj.name ?? "" }]}
        onAct={() => toggleMulligan(obj.id)}
        onInspect={() => setInspected({ obj, card: cardOf(obj) })}
        selected={mulligan.includes(obj.id)}
      />
    ) : (
      handPlayCard(obj, handSize)
    );
  const handItems = [
    ...(mine.champion && !spectator
      ? [
          {
            key: "champion",
            node: (
              <div className="pt-champion">
                {handPlayCard(mine.champion, handSize)}
                <span className="play-engrave">{t("zone.champion")}</span>
              </div>
            ),
          },
        ]
      : []),
    ...myHand.map((obj) => ({ key: obj.id, node: handCard(obj) })),
  ];

  const baseSize: CardSize = layout === "portrait" ? "sm" : "md";
  const board = (
    <>
      {others.map((player) => (
        <BaseStrip
          key={player.seat}
          title={t("zone.baseOf", { name: player.name })}
          choices={choicesOn(`base:${player.seat}`)}
          onAct={act}
          drop={dropOf(`base:${player.seat}`)}
        >
          {view.bases[player.seat].filter((obj) => !isRune(obj)).map((obj) => renderObj(obj, baseSize))}
          {ghostsAt("base", player.seat).map((ghost) => renderGhost(ghost, "sm"))}
          <Runes objs={view.bases[player.seat].filter(isRune)} cards={cards} choicesOn={choicesOn} onAct={act} />
          {spectator && player.hand && <SeenHand player={player} renderObj={renderObj} />}
        </BaseStrip>
      ))}

      <div className="pt-bfs" style={{ gridTemplateColumns: `repeat(${view.battlefields.length}, minmax(0, 1fr))` }}>
        {view.battlefields.map((bf) => (
          <BattlefieldColumn
            key={bf.index}
            bf={bf}
            view={view}
            me={me}
            showdown={view.showdown?.bf === bf.index}
            focus={focusBf === bf.index}
            ghosts={ghostsAt("bf", bf.index)}
            renderGhost={(ghost) => renderGhost(ghost, "sm")}
            choices={choicesOn(`bf:${bf.index}`)}
            onAct={act}
            card={renderObj(bf.card, layout === "tablet" ? "xl" : "lg")}
            renderObj={renderObj}
            unitSize={layout === "tablet" ? "md" : "sm"}
            colorOf={colorOf}
            drop={dropOf(`bf:${bf.index}`)}
          />
        ))}
      </div>

      <BaseStrip
        title={spectator ? t("zone.baseOf", { name: mine.name }) : t("zone.myBase")}
        choices={choicesOn(`base:${me}`)}
        onAct={act}
        mine
        drop={dropOf(`base:${me}`)}
      >
        {view.bases[me].filter((obj) => !isRune(obj)).map((obj) => renderObj(obj, layout === "tablet" ? "lg" : "md"))}
        {ghostsAt("base", me).map((ghost) => renderGhost(ghost))}
        <Runes
          objs={view.bases[me].filter(isRune)}
          cards={cards}
          choicesOn={choicesOn}
          onAct={act}
          marks={runeMarks}
          onRune={onRune}
        />
      </BaseStrip>
    </>
  );

  const bandOf = (player: EnginePlayer, compact: boolean) => (
    <PlayerBand
      key={player.seat}
      compact={compact}
      player={player}
      view={view}
      isMe={!spectator && player.seat === me}
      away={feed.away.includes(player.seat)}
      choices={choicesOn(`seat:${player.seat}`)}
      onAct={act}
      onTrash={() => setTrashOf(player.seat)}
      acting={actor === player.seat}
      color={colorOf(player.seat)}
      scoring={scoring.includes(player.seat)}
      legendName={cardOf(player.legend)?.name ?? player.legend.name ?? ""}
      legend={renderObj(player.legend, "xs")}
      addedLegends={(player.added_legends ?? []).map((added) => renderObj(added, "xs"))}
      champion={player.champion && (spectator || player.seat !== me) ? renderObj(player.champion, "xs") : null}
    />
  );

  const handTitle = spectator ? t("watch.handOf", { name: mine.name }) : t("zone.hand");
  const handCount = spectator ? (mine.hand?.length ?? 0) : myHand.length;
  const peeking = layout === "landscape";
  const handRaised = !peeking || handUp || mulliganing;
  const handSection =
    spectator && !mine.hand ? null : (
      <section
        data-play-hand
        aria-label={handTitle}
        className={cx("pt-hand", peeking && "pt-hand--peek", peeking && handRaised && "pt-hand--up")}
      >
        <button
          type="button"
          className="pt-hand__title"
          aria-expanded={peeking ? handRaised : undefined}
          onClick={() => peeking && setHandUp((up) => !up)}
        >
          <b>{handTitle}</b> · {handCount}
        </button>
        {spectator ? (
          <div className="pt-hand__row">{(mine.hand ?? []).map((obj) => renderObj(obj, "sm"))}</div>
        ) : myHand.length === 0 && !mine.champion ? (
          <p className="pt-muted pt-hand__empty">{t("zone.emptyHand")}</p>
        ) : (
          <div onClick={() => peeking && !handRaised && setHandUp(true)}>
            <HandFan items={handItems} />
          </div>
        )}
      </section>
    );

  // ---- La question, le récit, la chaîne.
  const narration = <Narration paced={paced} told={told} />;

  const promptNode = (
    <div className="pt-prompt" aria-live="polite">
      {feed.status === "reconnecting" && (
        <p className="pt-warn pt-row">
          <WifiOffIcon size={16} />
          {t("status.reconnecting")}
        </p>
      )}
      {view.result ? (
        <>
          <h2 className="pt-prompt__title pt-result">
            {view.result.winners.length === 0
              ? t("result.draw")
              : !spectator && view.result.winners.includes(me)
                ? t("result.won")
                : t("result.winner", { names: view.result.winners.map((seat) => view.players[seat].name).join(", ") })}
          </h2>
          <p className="pt-muted pt-small">{view.result.reason}</p>
          {afterResult}
        </>
      ) : paced.ack ? (
        <AckCard ack={paced.ack} view={view} cards={cards} onContinue={paced.proceed} told={told} />
      ) : watch ? (
        <WatchPanel paced={paced} hands={watch.hands} onHands={watch.onHands} turn={view.turn} />
      ) : prompt && sorted ? (
        <>
          <div className="pt-prompt__head">
            {prompt.card && cards[prompt.card] && (
              <PlayCard
                card={cards[prompt.card]}
                size="xs"
                onInspect={() => setInspected({ card: cards[prompt.card as string] })}
              />
            )}
            <div className="pt-grow">
              <h2 className="pt-prompt__title">{prompt.text}</h2>
              {prompt.card && cards[prompt.card]?.text && (
                <p className="pt-muted pt-small pt-clamp">{cards[prompt.card].text}</p>
              )}
              {choosingOnTable && <p className="pt-hint">{t("prompt.onTable")}</p>}
              {mulliganing && (
                <p className="pt-muted pt-small">{t("prompt.mulligan", { count: mulligan.length, max: mulliganMax })}</p>
              )}
            </div>
          </div>

          {mulliganing && (
            <button
              type="button"
              className="pt-btn pt-btn--grad pt-btn--block"
              onClick={() => {
                const choice = mulliganChoice(sorted.mulligan, mulligan);
                if (choice) act(choice.action);
              }}
              disabled={!mulliganChoice(sorted.mulligan, mulligan)}
            >
              {mulligan.length === 0 ? t("prompt.keepHand") : t("prompt.setAside", { count: mulligan.length })}
            </button>
          )}

          {payment && pay ? (
            <PaymentPanel
              payment={payment}
              cover={coverage(
                payment,
                mine.pool,
                (id) => {
                  const obj = view.bases[me].find((o) => o.id === id);
                  return (obj?.code ? cards[obj.code]?.domains[0]?.toLowerCase() : null) ?? null;
                },
                pay.choice,
                cards[prompt.card ?? ""]?.kind === "spell",
              )}
              choice={pay.choice}
              custom={pay.custom}
              objOf={(id) => view.bases[me].find((o) => o.id === id)}
              cardOf={cardOf}
              onCustom={(custom) => setPay({ custom, choice: custom ? pay.choice : proposedChoice(payment) })}
              onToggleAbility={toggleAbility}
              onPay={confirmPay}
              onCancel={(() => {
                const cancel = prompt.choices.find((choice) => choice.action.type === "cancel");
                return cancel ? () => act(cancel.action) : null;
              })()}
            />
          ) : (
            sorted.buttons.length > 0 && <ChoiceButtons key={promptKey} choices={sorted.buttons} onAct={act} />
          )}
          {myHand.length > 0 && !mulliganing && !payment && plays.length > 0 && (
            <p className="pt-hint pt-small">{t("hand.touchHint")}</p>
          )}
        </>
      ) : (
        <p className="pt-muted pt-row">
          {paced.busy
            ? t("pace.telling")
            : waitingFor
              ? t("prompt.waitingFor", { name: waitingFor.name })
              : t("prompt.waiting")}
        </p>
      )}
      {feed.error && <p className="pt-error">{feed.error}</p>}
    </div>
  );

  const chainNode =
    view.chain.length > 0 ? (
      <section className="pt-chain">
        <h3>{t("chain.title")}</h3>
        <ol>
          {view.chain.map((item, index) => {
            const choices = choicesOn(`item:${item.id}`);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cx("pt-chain__item", choices.length > 0 && "pt-chain__item--can")}
                  onClick={() => (choices.length > 0 ? act(choices[0].action) : setInspected({ card: cards[item.code] }))}
                >
                  <span className="pt-muted">{index + 1}.</span> <b>{cards[item.code]?.name ?? item.name}</b>{" "}
                  <span className="pt-muted">
                    {view.players[item.controller]?.name}
                    {item.pending ? ` · ${t("chain.pending")}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    ) : null;

  const journalNode = <Journal entries={journal} told={told} colorOf={colorOf} />;

  const watchControls = watch && !view.result && (
    <>
      <button
        type="button"
        className={cx("pt-icon", paced.paused && "pt-icon--on")}
        aria-pressed={paced.paused}
        aria-label={paced.paused ? t("watch.resume") : t("watch.pause")}
        onClick={() => paced.setPaused(!paced.paused)}
      >
        {paced.paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      {paced.paused && (
        <button type="button" className="pt-icon" aria-label={t("watch.step")} onClick={paced.step}>
          <StepIcon />
        </button>
      )}
    </>
  );
  const skipButton = paced.busy && !(watch && paced.paused) && (
    <button type="button" className="pt-icon" aria-label={t("pace.skip")} onClick={paced.skip}>
      <FastIcon />
    </button>
  );
  const quit = (
    <button type="button" className="pt-icon" aria-label={t("table.quit")} onClick={() => navigate(home)}>
      <BackIcon />
    </button>
  );
  const settingsButton = (
    <button type="button" className="pt-icon" aria-label={t("pace.settings")} onClick={() => setSheet("settings")}>
      <GaugeIcon />
    </button>
  );
  const turnPlayer = view.players[view.turn_seat];
  const turnChip = turnPlayer && (
    <p className="pt-turn">
      <b>{t("table.turn", { turn: view.turn })}</b>
      <span className="pt-dot" style={{ background: colorOf(view.turn_seat) }} />
      <span style={{ color: colorOf(view.turn_seat) }}>{turnPlayer.name}</span>
    </p>
  );

  // La bande du panneau replié : scores, qui joue, la dernière carte jouée, la progression du récit.
  const lastPlayed = [...journal].reverse().find((entry) => revealsCard(entry, spectator ? null : me));
  const lastId = lastPlayed
    ? typeof lastPlayed.event.obj === "number"
      ? lastPlayed.event.obj
      : typeof lastPlayed.event.source === "number"
        ? lastPlayed.event.source
        : null
    : null;
  const lastCode = lastId !== null ? codeOf(view, lastId) : null;
  const lastCard = lastCode ? cards[lastCode] : undefined;
  const strip = (
    <div className="pt-strip">
      <button type="button" className="pt-icon" aria-label={t("panel.open")} onClick={panel.toggle}>
        <BackIcon />
      </button>
      {view.players.map((player) => (
        <div
          key={player.seat}
          className={cx("pt-strip__player", view.turn_seat === player.seat && "pt-strip__player--turn")}
          style={{ "--who": colorOf(player.seat) } as CSSProperties}
          title={`${player.name} · ${t("player.points", { points: player.points, max: view.victory_score })}`}
        >
          <span className="pt-strip__initial">{player.name.slice(0, 2)}</span>
          <b>{player.points}</b>
        </div>
      ))}
      {lastCard && (
        <button
          type="button"
          className="pt-strip__last"
          aria-label={t("card.inspect", { name: lastCard.name })}
          onClick={() => setInspected({ card: lastCard })}
        >
          {lastCard.image ? <img src={lastCard.image} alt="" /> : <span>{lastCard.name}</span>}
        </button>
      )}
      <span className="pt-grow" />
      {paced.remaining > 0 && <span className="pt-strip__left">{paced.remaining}</span>}
      {step && step.ms > 0 && !paced.ack && (
        <span aria-hidden className="pt-strip__progress">
          <span key={step.index} className="play-progress" style={{ animationDuration: `${step.ms}ms` }} />
        </span>
      )}
      {watchControls}
    </div>
  );

  const panelStatus = (
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

  const overlays = (
    <>
      {(anywhere || intent?.armed) && (
        <div role="status" className="pt-placing">
          {anywhere ? t("hand.dropAnywhere") : t("hand.where", { name: (placingObj && cardOf(placingObj)?.name) ?? "" })}
          {intent?.armed && (
            <button type="button" className="pt-btn pt-btn--sm" onClick={() => setIntent(null)}>
              {t("hand.cancel")}
            </button>
          )}
        </div>
      )}
      {watch && paced.paused && !view.result && (
        <p role="status" className="pt-placing pt-placing--quiet">
          <PauseIcon size={14} />
          {t("watch.paused")}
        </p>
      )}
      <StepOverlay paced={paced} view={view} cards={cards} me={feed.seat} />
    </>
  );

  const flatBoard = <div className={cx("pt-felt", anywhere && "pt-felt--any")}>{board}</div>;

  const common = (
    <>
      <TableFx current={paced.current} journal={feed.journal} cards={cards} me={me} pace={paced.pace} />
      {drag && (
        <DragGhost card={cardOf(placingObj)} x={drag.x} y={drag.y} over={drag.target !== null} cost={hintOf(drag.card)?.cost} />
      )}
      {dropMenu && (
        <div role="menu" className="pt-drop-menu" style={{ left: dropMenu.x, top: dropMenu.y - 8 }}>
          <button type="button" className="pt-btn pt-btn--grad" onClick={() => playCard(dropMenu.card, { Bf: dropMenu.bf })}>
            {t("hand.playHere")}
          </button>
          <button
            type="button"
            className="pt-btn"
            onClick={() => {
              const hide = hideChoicesOf(dropMenu.card).find((choice) => choice.action.bf === dropMenu.bf);
              setDropMenu(null);
              if (hide) act(hide.action);
            }}
          >
            {t("hand.hideHere")}
          </button>
          <button type="button" className="pt-btn pt-btn--ghost" onClick={() => setDropMenu(null)}>
            {t("hand.cancel")}
          </button>
        </div>
      )}
      {inspected && (
        <InspectSheet
          inspected={inspected}
          onClose={() => setInspected(null)}
          playWhere={
            inspected.playable && inspected.obj && dropKeysOf(inspected.obj.id).length > 0 ? (
              <PlayWhere
                keys={dropKeysOf(inspected.obj.id)}
                hint={hintOf(inspected.obj.id)}
                view={view}
                cardOf={cardOf}
                domains={inspected.card?.domains ?? []}
                onPlay={() => {
                  const id = inspected.obj?.id;
                  setInspected(null);
                  if (id !== undefined) playButton(id);
                }}
              />
            ) : null
          }
        />
      )}
      {trashOf !== null && (
        <Sheet title={t("zone.trashOf", { name: view.players[trashOf].name })} onClose={() => setTrashOf(null)}>
          <p className="pt-muted pt-small">{t("zone.trashHint")}</p>
          <div className="pt-row-wrap">
            {view.players[trashOf].trash.length === 0 && <p className="pt-muted">{t("zone.empty")}</p>}
            {view.players[trashOf].trash.map((obj) => (
              <PlayCard key={obj.id} obj={obj} card={cardOf(obj)} size="md" onInspect={() => setInspected({ obj, card: cardOf(obj) })} />
            ))}
          </div>
          {view.players[trashOf].banish.length > 0 && (
            <>
              <h3 className="pt-subtitle">{t("zone.banish")}</h3>
              <div className="pt-row-wrap">
                {view.players[trashOf].banish.map((obj) => (
                  <PlayCard key={obj.id} obj={obj} card={cardOf(obj)} size="md" onInspect={() => setInspected({ obj, card: cardOf(obj) })} />
                ))}
              </div>
            </>
          )}
        </Sheet>
      )}
      {sheet === "journal" && (
        <Sheet title={t("journal.title")} onClose={() => setSheet(null)} className="pt-sheet--tall">
          {journalNode}
        </Sheet>
      )}
      {sheet === "settings" && (
        <Sheet title={t("pace.settings")} onClose={() => setSheet(null)}>
          <PaceSettings
            paced={paced}
            watching={Boolean(watch)}
            tablet={layout === "tablet"}
            onConcede={!spectator && !view.result ? () => act({ type: "concede" }) : undefined}
            onClose={() => setSheet(null)}
          />
          {note && <p className="pt-muted pt-small">{note}</p>}
        </Sheet>
      )}
    </>
  );

  if (layout === "landscape") {
    return (
      <div className="pt pt--landscape" data-play-scroll>
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
            {t("table.turnShort")}
            <b>{view.turn}</b>
          </div>
        </nav>
        <main data-play-table className="pt-center">
          {overlays}
          <div className="pt-board-scroll">{flatBoard}</div>
          {handSection}
        </main>
        <aside className={cx("pt-panel", !panel.open && "pt-panel--folded")} data-play-sheet>
          {panel.open ? (
            panelJournal ? (
              <>
                <div className="pt-panel__head">
                  <b className="pt-grow">{t("journal.title")}</b>
                  <button type="button" className="pt-icon pt-icon--sm" aria-label={t("panel.back")} onClick={() => setPanelJournal(false)}>
                    <ForwardIcon />
                  </button>
                </div>
                {journalNode}
              </>
            ) : (
              <>
                {panelStatus}
                <div className="pt-bands pt-bands--stack">{[...others, mine].map((player) => bandOf(player, true))}</div>
                {narration}
                {chainNode}
                <span className="pt-grow" />
                {promptNode}
              </>
            )
          ) : (
            strip
          )}
        </aside>
        {common}
      </div>
    );
  }

  if (layout === "tablet") {
    return (
      <div className="pt pt--tablet">
        <header className="pt-bar" data-play-bar>
          {quit}
          <div className="pt-bar__game">
            <b>Riftbound</b>
            {note && <span className="pt-muted pt-small">{note}</span>}
          </div>
          {turnChip}
          {narration}
          {watchControls}
          {skipButton}
          {settingsButton}
        </header>
        <div className="pt-tablet-body">
          <main data-play-table className="pt-center" data-play-scroll>
            {overlays}
            {relief ? (
              <TableScene
                dive={dive}
                rails={
                  <PointRails
                    players={view.players}
                    me={spectator ? null : me}
                    max={view.victory_score}
                    colorOf={colorOf}
                    label={(player) => `${player.name} · ${t("player.points", { points: player.points, max: view.victory_score })}`}
                  />
                }
                hand={handSection}
              >
                {board}
              </TableScene>
            ) : (
              <>
                {flatBoard}
                {handSection}
              </>
            )}
          </main>
          <aside className={cx("pt-panel", !panel.open && "pt-panel--folded")} data-play-sheet>
            {panel.open ? (
              <>
                {panelStatus}
                <div className="pt-bands pt-bands--stack">{[...others, mine].map((player) => bandOf(player, false))}</div>
                {promptNode}
                {chainNode}
                {journalNode}
              </>
            ) : (
              strip
            )}
          </aside>
        </div>
        {common}
      </div>
    );
  }

  return (
    <div className="pt pt--portrait">
      <header className="pt-bar" data-play-bar>
        {quit}
        {turnChip}
        <span className="pt-grow" />
        {watchControls}
        {skipButton}
        <button type="button" className="pt-icon" aria-label={t("journal.title")} onClick={() => setSheet("journal")}>
          <JournalIcon />
        </button>
        {settingsButton}
      </header>
      {narration}
      <main data-play-table className="pt-center" data-play-scroll>
        {overlays}
        <div className="pt-bands">{others.map((player) => bandOf(player, true))}</div>
        {flatBoard}
        <div className="pt-bands">{bandOf(mine, true)}</div>
      </main>
      {/* La main reste sous le pouce, hors de ce qui défile. */}
      {handSection}
      <section className="pt-dock" data-play-sheet>
        {chainNode}
        {promptNode}
      </section>
      {common}
    </div>
  );
}

function buttonKind(type: string): string {
  if (type === "pass" || type === "end_turn" || type === "done" || type === "yes") return "pt-btn--grad";
  if (type === "no" || type === "cancel") return "pt-btn--ghost";
  return "";
}

/** Au-delà de ce nombre, les choix défilent et se filtrent (nommer une carte ou un tag). */
const MANY_CHOICES = 12;

function ChoiceButtons({ choices, onAct }: { choices: EngineChoice[]; onAct: (action: EngineAction) => void }) {
  const t = usePlayT("Play");
  const [filter, setFilter] = useState("");
  const many = choices.length > MANY_CHOICES;
  const needle = filter.trim().toLocaleLowerCase();
  const shown = many && needle ? choices.filter((choice) => choice.label.toLocaleLowerCase().includes(needle)) : choices;

  return (
    <div className="pt-choices">
      {many && (
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("choices.filter")}
          aria-label={t("choices.filter")}
          className="pt-input"
        />
      )}
      <div className={cx("pt-choices__list", many && "pt-choices__list--many")}>
        {shown.map((choice, index) => (
          <button key={index} type="button" className={cx("pt-btn", buttonKind(choice.action.type))} onClick={() => onAct(choice.action)}>
            {choice.label}
          </button>
        ))}
        {shown.length === 0 && <p className="pt-muted">{t("choices.none")}</p>}
      </div>
    </div>
  );
}

type PlayerBandProps = {
  /** Sur une ligne serrée (téléphone, panneau latéral) ou en carte (tablette). */
  compact: boolean;
  player: EnginePlayer;
  view: EngineView;
  isMe: boolean;
  away: boolean;
  choices: EngineChoice[];
  onAct: (action: EngineAction) => void;
  onTrash: () => void;
  acting?: boolean;
  scoring?: boolean;
  color?: string;
  legendName: string;
  legend: ReactNode;
  addedLegends?: ReactNode[];
  champion: ReactNode;
};

/** Le bandeau d'un joueur : qui il est, son score en grand, puis ses compteurs. */
function PlayerBand({
  compact,
  player,
  view,
  isMe,
  away,
  choices,
  onAct,
  onTrash,
  acting = false,
  scoring = false,
  color,
  legendName,
  legend,
  addedLegends,
  champion,
}: PlayerBandProps) {
  const t = usePlayT("Play");
  const turn = view.turn_seat === player.seat;
  const deciding = view.pending?.seat === player.seat && !view.result;
  const max = view.victory_score;
  const runes = player.runes_ready + player.runes_exhausted;
  const power = DOMAINS.map((domain, index) => ({ domain, amount: player.pool.power[index] ?? 0 })).filter(
    (entry) => entry.amount > 0,
  );

  return (
    <section
      aria-label={player.name}
      className={cx(
        "pt-band",
        compact && "pt-band--compact",
        turn && "pt-band--turn",
        acting && "play-focus",
        !player.alive && "pt-band--out",
        choices.length > 0 && "pt-band--can",
      )}
      style={{ "--who": color } as CSSProperties}
    >
      <div className="pt-band__top">
        <div className="pt-band__cards">
          {legend}
          {champion}
        </div>
        <div className="pt-grow pt-band__who">
          <p className="pt-band__name">
            <span style={{ color }}>{player.name}</span>
            {isMe && <span className="pt-muted"> · {t("player.you")}</span>}
          </p>
          <p className="pt-band__state">
            {away ? (
              <span className="pt-warn">{t("player.away")}</span>
            ) : turn ? (
              <span className="pt-hint">{t("player.turn")}</span>
            ) : deciding ? (
              t("player.deciding")
            ) : (
              legendName
            )}
          </p>
        </div>
        <p className="pt-band__score" aria-label={t("player.points", { points: player.points, max })}>
          {player.points}
          <span>/{max}</span>
        </p>
      </div>
      <div aria-hidden className="pt-band__track">
        {Array.from({ length: max }, (_, index) => (
          <span
            key={index}
            className={cx(scoring && index === player.points - 1 && "pt-band__pip--scored")}
            style={index < player.points ? { background: color } : undefined}
          />
        ))}
      </div>
      {addedLegends && addedLegends.length > 0 && <div className="pt-row-wrap">{addedLegends}</div>}
      <div className="pt-band__stats">
        <span title={t("player.hand")}>
          {t("player.hand")} <b>{player.hand_count}</b>
        </span>
        <span title={t("player.deck")}>
          {t("player.deck")} <b>{player.deck_count}</b>
        </span>
        <span title={t("player.runes")}>
          {t("player.runes")} <b>{`${player.runes_ready}/${runes}`}</b>
        </span>
        <button type="button" onClick={onTrash} title={t("player.trash", { count: player.trash.length })}>
          <TrashIcon size={12} /> <b>{player.trash.length}</b>
        </button>
        {player.pool.energy > 0 && <span className="pt-pool">{t("player.energy", { count: player.pool.energy })}</span>}
        {power.map((entry) => (
          <span key={entry.domain} className="pt-pool">
            <span className="pt-dot" style={{ background: DOMAIN_HEX[entry.domain] }} />
            {entry.amount} {t(`domain.${entry.domain}`)}
          </span>
        ))}
        {choices.map((choice, index) => (
          <button key={index} type="button" className="pt-btn pt-btn--sm pt-btn--grad" onClick={() => onAct(choice.action)}>
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function dropClass(drop: DropState | undefined): string | false {
  if (!drop?.state) return false;
  if (drop.state === "off") return "pt-drop--off";
  return drop.state === "hot" ? "pt-drop--hot" : "pt-drop--ok";
}

/** Un emplacement permis, en attente d'un toucher (après « Jouer »). */
function DropPick({ drop, label }: { drop: DropState | undefined; label: string }) {
  const t = usePlayT("Play");
  if (!drop?.onPick || drop.state !== "ok") return null;
  return (
    <button
      type="button"
      className="pt-drop-pick"
      aria-label={t("hand.playAt", { place: label })}
      onClick={(event) => drop.onPick?.(event)}
    >
      <span>{t("hand.here")}</span>
    </button>
  );
}

/** Dans l'aperçu d'une carte jouable : où elle peut aller, son coût, et le bouton Jouer. */
function PlayWhere({
  keys,
  hint,
  view,
  cardOf,
  domains,
  onPlay,
}: {
  keys: string[];
  hint: EnginePlayHint | undefined;
  view: EngineView;
  cardOf: (obj: EngineObj | undefined | null) => TableCard | undefined;
  domains: string[];
  onPlay: () => void;
}) {
  const t = usePlayT("Play");
  const place = (key: string) => {
    const loc = keyLoc(key);
    if (!loc) return "";
    if ("Base" in loc) return t("hand.base");
    const bf = view.battlefields[loc.Bf];
    return (bf && cardOf(bf.card)?.name) ?? t("hand.battlefield", { n: loc.Bf + 1 });
  };
  return (
    <div className="pt-play-where">
      {hint && (
        <p className="pt-row">
          {t("hand.cost")} <CostChips cost={hint.cost} domains={domains} />
        </p>
      )}
      <p className="pt-muted pt-small">
        {keys.includes("any") ? t("hand.whereSpell") : t("hand.whereList", { places: keys.map(place).join(" · ") })}
      </p>
      <button type="button" className="pt-btn pt-btn--grad pt-btn--block" onClick={onPlay}>
        {t("hand.play")}
      </button>
    </div>
  );
}

function BaseStrip({
  title,
  choices,
  onAct,
  mine = false,
  drop,
  children,
}: {
  drop?: DropState;
  title: string;
  choices: EngineChoice[];
  onAct: (action: EngineAction) => void;
  mine?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      data-drop={drop?.key}
      className={cx("pt-zone", mine && "pt-zone--mine", choices.length > 0 && "pt-zone--can", dropClass(drop))}
      aria-label={title}
    >
      <DropPick drop={drop} label={title} />
      <div className="pt-zone__head">
        <h3 className="play-engrave">{title}</h3>
        {choices.map((choice, index) => (
          <button key={index} type="button" className="pt-btn pt-btn--sm pt-btn--grad" onClick={() => onAct(choice.action)}>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="pt-zone__cards">{children}</div>
    </section>
  );
}

type RunesProps = {
  objs: EngineObj[];
  cards: TableCards;
  choicesOn: (key: string) => EngineChoice[];
  onAct: (action: EngineAction) => void;
  marks?: Record<number, RuneUse>;
  onRune?: (id: number) => void;
};

/** Les runes d'une base : une pastille par rune, à la couleur de son domaine. */
function Runes({ objs, cards, choicesOn, onAct, marks = {}, onRune }: RunesProps) {
  const t = usePlayT("Play");
  if (objs.length === 0) return null;
  const ready = objs.filter((obj) => !obj.exhausted).length;
  return (
    <div className="pt-runes">
      <div className="pt-runes__dots" aria-label={t("player.runes")}>
        {objs.map((obj) => {
          const card = obj.code ? cards[obj.code] : undefined;
          const domain = card?.domains[0]?.toLowerCase() ?? "";
          const choices = choicesOn(`obj:${obj.id}`);
          const title = `${card?.name ?? t("player.runes")}${obj.exhausted ? ` · ${t("card.exhausted")}` : ""}`;
          const mark = marks[obj.id] && marks[obj.id] !== "none" ? marks[obj.id] : null;
          const dot = (
            <span className="pt-rune">
              <span
                className={cx(
                  "pt-rune__dot",
                  obj.exhausted && "pt-rune__dot--off",
                  (choices.length > 0 || onRune) && "pt-rune__dot--can",
                  mark && `pt-rune__dot--${mark}`,
                )}
                style={{ background: DOMAIN_HEX[domain] ?? "#64748b" }}
              />
              {mark && mark !== "none" && (
                <span className={cx("pt-rune__mark", mark === "recycle" && "pt-rune__mark--recycle")}>
                  {RUNE_MARK[mark as keyof typeof RUNE_MARK]}
                </span>
              )}
            </span>
          );
          const label = `${title}${mark && mark !== "none" ? ` · ${t(`payment.mark.${mark}`)}` : ""}`;
          if (onRune) {
            return (
              <button key={obj.id} type="button" title={label} aria-label={label} onClick={() => onRune(obj.id)}>
                {dot}
              </button>
            );
          }
          return choices.length > 0 ? (
            <button
              key={obj.id}
              type="button"
              title={choices.map((choice) => choice.label).join(" / ")}
              onClick={() => onAct(choices[0].action)}
            >
              {dot}
            </button>
          ) : (
            <span key={obj.id} title={title}>
              {dot}
            </span>
          );
        })}
      </div>
      <p className="pt-runes__count">{t("player.runesReady", { ready, total: objs.length })}</p>
    </div>
  );
}

type BattlefieldColumnProps = {
  bf: EngineBattlefield;
  view: EngineView;
  me: number;
  showdown: boolean;
  focus: boolean;
  ghosts: Ghost[];
  renderGhost: (ghost: Ghost) => ReactNode;
  choices: EngineChoice[];
  onAct: (action: EngineAction) => void;
  card: ReactNode;
  renderObj: (obj: EngineObj, size?: CardSize) => ReactNode;
  unitSize: CardSize;
  colorOf: (seat: number) => string;
  drop?: DropState;
};

function BattlefieldColumn({
  bf,
  view,
  me,
  showdown,
  focus,
  ghosts,
  renderGhost,
  choices,
  onAct,
  card,
  renderObj,
  unitSize,
  colorOf,
  drop,
}: BattlefieldColumnProps) {
  const t = usePlayT("Play");
  const mineHere = bf.units.filter((obj) => obj.controller === me);
  const ghostsOf = (seat: number) => ghosts.filter((ghost) => ghost.obj.controller === seat);
  const theirs = view.players
    .filter((player) => player.seat !== me)
    .map((player) => ({
      player,
      units: bf.units.filter((obj) => obj.controller === player.seat),
      ghosts: ghostsOf(player.seat),
    }))
    .filter((group) => group.units.length + group.ghosts.length > 0);
  const several = view.players.length > 2;

  const status =
    bf.contested_by !== null
      ? t("bf.contested", { name: view.players[bf.contested_by].name })
      : bf.controller !== null
        ? t("bf.controlled", { name: view.players[bf.controller].name })
        : t("bf.free");
  const control =
    bf.contested_by !== null ? "contested" : bf.controller === null ? "free" : bf.controller === me ? "me" : "other";

  return (
    <section
      data-bf={bf.index}
      data-drop={drop?.key}
      aria-label={status}
      className={cx(
        "pt-zone pt-bf",
        showdown && "pt-bf--showdown",
        focus && "pt-bf--focus",
        choices.length > 0 && "pt-zone--can",
        dropClass(drop),
      )}
    >
      <DropPick drop={drop} label={status} />
      <span
        className="play-pennant"
        data-control={control}
        style={
          control !== "contested" && bf.controller !== null
            ? ({ "--pennant": colorOf(bf.controller) } as CSSProperties)
            : undefined
        }
      >
        {status}
      </span>
      <div className="pt-bf__units pt-bf__units--theirs">
        {theirs.map((group) => (
          <div key={group.player.seat} className="pt-bf__group">
            {several && <span className="pt-muted pt-tiny">{group.player.name}</span>}
            <div className="pt-row-wrap pt-row-wrap--center">
              {group.units.map((obj) => renderObj(obj, unitSize))}
              {group.ghosts.map((ghost) => renderGhost(ghost))}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-bf__card">
        {card}
        {showdown && <span className="pt-chip-warn">{t("bf.showdown")}</span>}
        {bf.facedown.length > 0 && <div className="pt-row-wrap pt-row-wrap--center">{bf.facedown.map((obj) => renderObj(obj, "xs"))}</div>}
        {choices.map((choice, index) => (
          <button key={index} type="button" className="pt-btn pt-btn--sm pt-btn--grad" onClick={() => onAct(choice.action)}>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="pt-bf__units">
        {mineHere.map((obj) => renderObj(obj, unitSize))}
        {ghostsOf(me).map((ghost) => renderGhost(ghost))}
      </div>
    </section>
  );
}

type JournalTurn = { start: number; title: string | null; seat: number | null; items: { entry: EngineTold; index: number }[] };

/** Le journal découpé par tour : chaque début de tour ouvre un groupe et lui donne son titre. */
function byTurn(entries: EngineTold[]): JournalTurn[] {
  const turns: JournalTurn[] = [];
  entries.forEach((entry, index) => {
    if (eventType(entry) === "turn_started") {
      turns.push({ start: index, title: plain(entry.text), seat: actorOf(entry), items: [] });
      return;
    }
    if (turns.length === 0) turns.push({ start: index, title: null, seat: null, items: [] });
    turns[turns.length - 1].items.push({ entry, index });
  });
  return turns;
}

function Journal({
  entries,
  told,
  colorOf,
}: {
  entries: EngineTold[];
  told: (text: string) => ReactNode;
  colorOf: (seat: number) => string;
}) {
  const t = usePlayT("Play");
  const list = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<"all" | "turn">("all");
  const turns = useMemo(() => byTurn(entries), [entries]);
  const shown = scope === "turn" ? turns.slice(-1) : turns;

  useEffect(() => {
    const container = list.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [entries.length, scope]);

  return (
    <section className="pt-journal">
      <div className="segmented pt-journal__scope" role="group" aria-label={t("journal.title")}>
        {(["turn", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={cx("segmented__item", scope === value && "segmented__item--active")}
          >
            {t(value === "turn" ? "journal.thisTurn" : "journal.all")}
          </button>
        ))}
      </div>
      <div ref={list} className="pt-journal__list">
        {entries.length === 0 && <p className="pt-muted">{t("journal.empty")}</p>}
        {shown.map((turn) => (
          <section key={turn.start}>
            <h4>
              <span className="pt-dot" style={turn.seat !== null ? { background: colorOf(turn.seat) } : undefined} />
              {turn.title ?? t("journal.setup")}
            </h4>
            <ol>
              {turn.items.map(({ entry, index }) => (
                <li key={index} className={cx(entry.text?.startsWith(" ") && "pt-journal__sub")}>
                  {told(entry.text?.trim() ?? "")}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

/** Le récit : l'évènement au premier plan et ce qui reste à raconter. */
function Narration({ paced, told }: { paced: PacedFeed; told: (text: string) => ReactNode }) {
  const t = usePlayT("Play");
  const step = paced.current;
  const shown = step?.entry ?? paced.journal[paced.journal.length - 1];
  return (
    <div aria-live="polite" className="pt-narration">
      <p key={step?.index ?? "idle"} className={cx("pt-narration__text", !step && "pt-muted")}>
        {shown?.text ? told(shown.text.trim()) : t("journal.empty")}
      </p>
      {paced.remaining > 0 && <span className="pt-narration__left">{t("pace.remaining", { count: paced.remaining })}</span>}
      {step && !paced.ack && step.ms > 0 && (
        <span aria-hidden className="pt-narration__bar">
          <span key={step.index} className="play-progress" style={{ animationDuration: `${step.ms}ms` }} />
        </span>
      )}
    </div>
  );
}

function SeenHand({ player, renderObj }: { player: EnginePlayer; renderObj: (obj: EngineObj, size?: CardSize) => ReactNode }) {
  const t = usePlayT("Play");
  if (!player.hand || player.hand.length === 0) return null;
  return (
    <div className="pt-seen-hand">
      <span className="pt-muted pt-tiny">
        {t("watch.handOf", { name: player.name })} · {player.hand.length}
      </span>
      <div className="pt-row-wrap">{player.hand.map((obj) => renderObj(obj, "xs"))}</div>
    </div>
  );
}

function WatchPanel({
  paced,
  hands,
  onHands,
  turn,
}: {
  paced: PacedFeed;
  hands: boolean;
  onHands: (hands: boolean) => void;
  turn: number;
}) {
  const t = usePlayT("Play");
  return (
    <div className="pt-watch">
      <h2 className="pt-prompt__title">{t("watch.title")}</h2>
      <p className="pt-muted pt-small">{paced.paused ? t("watch.pausedHint", { turn }) : t("watch.playingHint")}</p>
      <div className="pt-row-wrap">
        <button type="button" className="pt-btn pt-btn--grad" onClick={() => paced.setPaused(!paced.paused)}>
          {paced.paused ? t("watch.resumeLong") : t("watch.pauseLong")}
        </button>
        {paced.paused && (
          <button type="button" className="pt-btn" onClick={paced.step}>
            {t("watch.step")}
          </button>
        )}
      </div>
      <Toggle checked={hands} onChange={onHands} label={t("watch.hands")} />
    </div>
  );
}

function PaceSettings({
  paced,
  watching,
  tablet,
  onConcede,
  onClose,
}: {
  paced: PacedFeed;
  watching: boolean;
  tablet: boolean;
  onConcede?: () => void;
  onClose: () => void;
}) {
  const t = usePlayT("Play");
  const [conceding, setConceding] = useState(false);
  const set = (patch: Partial<PacedFeed["pace"]>) => paced.setPace({ ...paced.pace, ...patch });
  return (
    <div className="pt-settings">
      <div className="segmented" role="group" aria-label={t("pace.settings")}>
        {PACE_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={paced.pace.speed === speed}
            className={cx("segmented__item", paced.pace.speed === speed && "segmented__item--active")}
            onClick={() => set({ speed })}
          >
            {t(`pace.speed.${speed}`)}
          </button>
        ))}
      </div>
      {watching ? (
        <Toggle
          checked={paced.pace.watchStops}
          onChange={(watchStops) => set({ watchStops })}
          label={t("watch.stops")}
          hint={t("watch.stopsHint")}
        />
      ) : (
        <Toggle checked={paced.pace.stops} onChange={(stops) => set({ stops })} label={t("pace.stops")} hint={t("pace.stopsHint")} />
      )}
      {tablet && (
        <>
          <p className="pt-subtitle">{t("pace.view")}</p>
          <div className="segmented" role="group" aria-label={t("pace.view")}>
            {TABLE_VIEWS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={paced.pace.view === value}
                className={cx("segmented__item", paced.pace.view === value && "segmented__item--active")}
                onClick={() => set({ view: value })}
              >
                {t(`pace.views.${value}`)}
              </button>
            ))}
          </div>
          <Toggle
            checked={paced.pace.camera}
            disabled={paced.pace.view !== "3d"}
            onChange={(camera) => set({ camera })}
            label={t("pace.camera")}
            hint={t("pace.cameraHint")}
          />
        </>
      )}
      <Toggle checked={paced.pace.effects} onChange={(effects) => set({ effects })} label={t("pace.effects")} hint={t("pace.effectsHint")} />
      {!watching && (
        <Toggle checked={paced.pace.autoPay} onChange={(autoPay) => set({ autoPay })} label={t("pace.autoPay")} hint={t("pace.autoPayHint")} />
      )}
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

/** Au centre de la table, le temps de l'évènement : la carte jouée par un adversaire, ou le nouveau tour. */
function StepOverlay({ paced, view, cards, me }: { paced: PacedFeed; view: EngineView; cards: TableCards; me: number | null }) {
  const step = paced.current;
  if (!step) return null;
  const type = eventType(step.entry);

  if (type === "turn_started") {
    return (
      <div className="pt-step">
        <p key={step.index} className="pt-step__banner play-banner">
          {plain(step.entry.text)}
        </p>
      </div>
    );
  }

  if (!revealsCard(step.entry, me)) return null;
  const event = step.entry.event;
  const id = typeof event.obj === "number" ? event.obj : typeof event.source === "number" ? event.source : null;
  const code = id !== null ? codeOf(view, id) : null;
  const card = code ? cards[code] : undefined;
  if (!card) return null;
  return (
    <div className="pt-step">
      <div key={step.index} className="pt-step__card play-enter">
        <span className="pt-muted pt-small">{plain(step.entry.text)}</span>
        <PlayCard card={card} size="lg" />
      </div>
    </div>
  );
}

/** Un moment clé : la lecture attend « Continuer ». */
function AckCard({
  ack,
  view,
  cards,
  onContinue,
  told,
}: {
  ack: Ack;
  view: EngineView;
  cards: TableCards;
  onContinue: () => void;
  told: (text: string) => ReactNode;
}) {
  const t = usePlayT("Play");
  const code = ack.objId !== null ? codeOf(view, ack.objId) : null;
  const card = code ? cards[code] : undefined;
  return (
    <div className="pt-ack">
      <div className="pt-prompt__head">
        {card && <PlayCard card={card} size="xs" />}
        <div className="pt-grow">
          <h2 className="pt-prompt__title">{ack.kind === "turn" ? t("pace.yourTurn") : told(plain(ack.title))}</h2>
          {card?.text && <p className="pt-muted pt-small pt-clamp">{card.text}</p>}
          {ack.kind === "turn" && <p className="pt-muted pt-small">{t("pace.sinceLastTurn")}</p>}
          {ack.lines.length > 0 && (
            <ul className="pt-ack__lines">
              {ack.lines.map((line, index) => (
                <li key={index}>{told(line)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button type="button" className="pt-btn pt-btn--grad pt-btn--block" onClick={onContinue}>
        {ack.kind === "turn" ? t("pace.play") : t("pace.continue")}
      </button>
    </div>
  );
}

/** Une carte en grand : son illustration, son texte, son état, et, en main, le bouton Jouer. */
function InspectSheet({ inspected, onClose, playWhere }: { inspected: Inspected; onClose: () => void; playWhere: ReactNode }) {
  const t: PlayT = usePlayT("Play");
  const { card, obj } = inspected;
  return (
    <Sheet title={card?.name ?? obj?.name ?? t("card.hidden")} onClose={onClose}>
      <p className="pt-muted pt-small">{card ? t(`kind.${card.kind}`) : t("card.hiddenHint")}</p>
      {card && (
        <div className="pt-inspect">
          {card.image && <img src={card.image} alt="" className={cx("pt-inspect__img", card.landscape && "pt-inspect__img--land")} />}
          <div className="pt-inspect__text">
            {playWhere}
            {card.text && <p className="pt-pre">{card.text}</p>}
            {obj && obj.keywords.length > 0 && (
              <div className="pt-row-wrap">
                {obj.keywords.map((keyword) => (
                  <span key={keyword} className="chip">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
            {obj && (
              <ul className="pt-muted pt-small">
                {obj.might !== null && <li>{t("card.might", { might: obj.might, damage: obj.damage })}</li>}
                {obj.exhausted && <li>{t("card.exhausted")}</li>}
                {obj.stunned && <li>{t("card.stunned")}</li>}
                {obj.buffs > 0 && <li>{t("card.buffed")}</li>}
              </ul>
            )}
            {!card.playable && <p className="pt-warn">{t("card.unsupported")}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export type { TableLayout };
