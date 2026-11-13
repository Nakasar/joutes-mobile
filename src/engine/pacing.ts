/**
 * Le rythme de la table : le moteur rend un tour entier d'un coup, la table le
 * raconte pas à pas. Ce module ne dépend que des évènements du moteur
 * (`EngineTold`) ; le minutage et l'affichage sont dans `usePacedFeed` et
 * `GameTable`.
 */

import type { EngineObj, EngineTold, EngineView } from "./types";

/** Le poids d'un évènement raconté : il fixe le temps qu'il reste affiché. */
export type Weight = "minor" | "normal" | "major";

export type PaceSpeed = "slow" | "normal" | "fast" | "instant";

export const PACE_SPEEDS: PaceSpeed[] = ["slow", "normal", "fast", "instant"];

/** La table en relief (plateau incliné, décor) ou à plat. */
export type TableView = "3d" | "flat";

export const TABLE_VIEWS: TableView[] = ["3d", "flat"];

export type PaceSettings = {
  speed: PaceSpeed;
  /** S'arrêter sur « Continuer » aux moments clés. */
  stops: boolean;
  view: TableView;
  /** En relief, la caméra plonge sur le champ de bataille d'un combat raconté. */
  camera: boolean;
  /**
   * En spectateur d'une partie entre IA : s'arrêter aux moments clés. Désactivé
   * d'office, la pause étant à la main.
   */
  watchStops: boolean;
  /** Les effets des cartes sur la table : éclairs, comètes, flammes… */
  effects: boolean;
  /** Payer tout de suite ce que le moteur propose, sans montrer le paiement. */
  autoPay: boolean;
};

export const DEFAULT_PACE: PaceSettings = {
  speed: "normal",
  stops: true,
  view: "3d",
  camera: true,
  watchStops: false,
  effects: true,
  autoPay: false,
};

const BASE_MS: Record<Weight, number> = { minor: 350, normal: 900, major: 1500 };
export const SPEED_FACTOR: Record<PaceSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5, instant: 0 };
/** Ses propres actions se lisent plus vite : on sait ce qu'on vient de faire. */
const OWN_FACTOR = 0.5;

/** Au-delà de ce retard (reconnexion, onglet resté en arrière-plan), on rattrape d'un coup. */
export const CATCH_UP_LIMIT = 60;

const MINOR = new Set([
  "channeled",
  "drew",
  "paid",
  "exhausted",
  "readied",
  "buff_spent",
  "looked",
  "recycled",
  "put_in_deck",
  "xp_gained",
  "xp_spent",
  "named",
  "points",
  "turn_ended",
]);

const MAJOR = new Set([
  "turn_started",
  "played",
  "activated",
  "combat_started",
  "scored",
  "countered",
  "spell_taken",
  "battlefield_changed",
  "extra_turn",
  "game_ended",
  "conceded",
]);

export function eventType(entry: EngineTold): string {
  return entry.event.type;
}

/** Le siège qui fait l'action racontée, quand l'évènement en nomme un. */
export function actorOf(entry: EngineTold): number | null {
  const seat = entry.event.seat ?? entry.event.attacker;
  return typeof seat === "number" ? seat : null;
}

export function weightOf(entry: EngineTold): Weight {
  const type = eventType(entry);
  if (MAJOR.has(type)) return "major";
  if (MINOR.has(type)) return "minor";
  return "normal";
}

/** Le temps, en millisecondes, pendant lequel un évènement reste au premier plan. */
export function delayOf(entry: EngineTold, me: number | null, speed: PaceSpeed): number {
  const own = me !== null && actorOf(entry) === me;
  return Math.round(BASE_MS[weightOf(entry)] * SPEED_FACTOR[speed] * (own ? OWN_FACTOR : 1));
}

function ids(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (!Array.isArray(value)) return [];
  // `assigned` : [[unité, dégâts], …] ; `cards` de Revealed/Burned : [[objet, définition], …].
  return value.flatMap((item) => (Array.isArray(item) ? (typeof item[0] === "number" ? [item[0]] : []) : ids(item)));
}

/** Les objets que l'évènement concerne : ils sont mis en évidence sur la table. */
export function objectsOf(entry: EngineTold): number[] {
  const event = entry.event;
  const found = [
    ...ids(event.obj),
    ...ids(event.unit),
    ...ids(event.units),
    ...ids(event.objs),
    ...ids(event.source),
    ...ids(event.gear),
    ...ids(event.card),
    ...ids(event.assigned),
  ];
  return [...new Set(found)];
}

/** Le champ de bataille concerné, s'il y en a un. */
export function battlefieldOf(entry: EngineTold): number | null {
  const event = entry.event;
  if (typeof event.bf === "number") return event.bf;
  const to = event.to as { Bf?: unknown } | null | undefined;
  if (to && typeof to === "object" && typeof to.Bf === "number") return to.Bf;
  return null;
}

/** Les dégâts infligés à une unité par cet évènement, pour les afficher sur elle. */
export function damageOf(entry: EngineTold): Map<number, number> {
  const out = new Map<number, number>();
  const event = entry.event;
  if (eventType(entry) === "damaged" && typeof event.unit === "number" && typeof event.amount === "number") {
    out.set(event.unit, event.amount);
  }
  return out;
}

/** Les unités qui meurent dans ce lot d'évènements. */
export function diedIn(entries: EngineTold[]): Set<number> {
  const out = new Set<number>();
  for (const entry of entries) {
    if (eventType(entry) === "died" && typeof entry.event.unit === "number") out.add(entry.event.unit);
  }
  return out;
}

/** Une carte de l'adversaire montrée en grand le temps de la lire. */
export function revealsCard(entry: EngineTold, me: number | null): boolean {
  const type = eventType(entry);
  if (type !== "played" && type !== "activated") return false;
  const actor = actorOf(entry);
  return actor !== null && actor !== me;
}

/** Où l'objet se trouve dans une vue, pour le dessiner encore un instant (une unité qui meurt). */
export type Place = { base: number } | { bf: number };

export function placeOf(view: EngineView, id: number): { obj: EngineObj; place: Place } | null {
  for (const [seat, base] of view.bases.entries()) {
    const obj = base.find((item) => item.id === id);
    if (obj) return { obj, place: { base: seat } };
  }
  for (const bf of view.battlefields) {
    const obj = bf.units.find((item) => item.id === id);
    if (obj) return { obj, place: { bf: bf.index } };
  }
  return null;
}

/** Le code de carte d'un objet nommé par un évènement, où qu'il soit dans la vue. */
export function codeOf(view: EngineView, id: number): string | null {
  const lists: EngineObj[][] = [
    ...view.bases,
    ...view.battlefields.flatMap((bf) => [bf.units, bf.facedown, [bf.card]]),
    ...view.players.flatMap((player) => [
      player.hand ?? [],
      player.trash,
      player.banish,
      [player.legend],
      player.added_legends ?? [],
      player.champion ? [player.champion] : [],
    ]),
  ];
  for (const list of lists) {
    const obj = list.find((item) => item.id === id);
    if (obj?.code) return obj.code;
  }
  const item = view.chain.find((link) => link.source === id);
  return item?.code ?? null;
}

/** Un arrêt « Continuer » : ce qu'on vient de voir, résumé. */
export type Ack = {
  /** L'entrée du journal après laquelle la lecture s'arrête. */
  at: number;
  kind: "card" | "combat" | "score" | "turn";
  title: string;
  lines: string[];
  /** La carte à montrer (carte jouée ou capacité activée). */
  objId: number | null;
};

const SUMMARY_TYPES = new Set([
  "played",
  "activated",
  "moved",
  "died",
  "scored",
  "countered",
  "control_changed",
  "token_created",
  "returned_to_hand",
  "banished",
  "discarded",
  "unit_control_changed",
]);

const text = (entry: EngineTold) => (entry.text ?? "").trim();

/**
 * L'arrêt qui suit l'entrée `index` du journal, s'il y en a un. `batchStart` et
 * `batchEnd` bornent le lot (une mise à jour du moteur) qui la contient : un
 * combat et un début de tour se résument à la fin de leur lot.
 *
 * - Une carte jouée ou une capacité activée par un autre joueur ;
 * - la fin d'un combat ;
 * - des points marqués par un autre joueur hors combat ;
 * - le début de mon tour, avec ce qui s'est passé depuis mon tour précédent.
 */
export function ackAfter(
  journal: EngineTold[],
  index: number,
  batchStart: number,
  batchEnd: number,
  me: number | null,
): Ack | null {
  const entry = journal[index];
  if (!entry) return null;
  const type = eventType(entry);
  const actor = actorOf(entry);
  const other = actor !== null && actor !== me;
  const batch = journal.slice(batchStart, batchEnd);
  const combat = batch.findIndex((item) => eventType(item) === "combat_started");
  if (batch.some((item) => eventType(item) === "game_ended")) return null;

  if ((type === "played" || type === "activated") && other) {
    const obj = typeof entry.event.obj === "number" ? entry.event.obj : typeof entry.event.source === "number" ? entry.event.source : null;
    return { at: index, kind: "card", title: text(entry), lines: [], objId: obj };
  }

  if (type === "scored" && other && combat < 0) {
    const lines = journal
      .slice(index + 1, batchEnd)
      .filter((item) => eventType(item) === "points")
      .map(text);
    return { at: index, kind: "score", title: text(entry), lines, objId: null };
  }

  if (index !== batchEnd - 1) return null;

  const myTurn = me === null ? -1 : batch.findIndex((item) => eventType(item) === "turn_started" && actorOf(item) === me);
  if (myTurn >= 0) {
    // Ce qui s'est passé depuis mon tour précédent (ou le début de la partie).
    const turnAt = batchStart + myTurn;
    let from = 0;
    for (let at = turnAt - 1; at >= 0; at -= 1) {
      const item = journal[at];
      if (eventType(item) === "turn_started" && actorOf(item) === me) {
        from = at + 1;
        break;
      }
    }
    const lines = journal
      .slice(from, turnAt)
      .filter((item) => SUMMARY_TYPES.has(eventType(item)) && actorOf(item) !== me)
      .map(text)
      .filter(Boolean);
    // Mon premier tour, ou rien à raconter : pas d'arrêt.
    if (lines.length === 0) return null;
    const shown = lines.length > 8 ? [...lines.slice(0, 7), `… (+${lines.length - 7})`] : lines;
    return { at: index, kind: "turn", title: text(journal[turnAt]), lines: shown, objId: null };
  }

  if (combat >= 0) {
    const lines = batch
      .slice(combat + 1)
      .map(text)
      .filter(Boolean);
    return { at: index, kind: "combat", title: text(batch[combat]), lines, objId: null };
  }

  return null;
}

/**
 * Ce qui montre qu'un combat est fini : la partie reprend son cours (un coût
 * payé, une carte jouée, un déplacement, un autre tour…). Le journal de la
 * table ne garde que les évènements racontés : la fin de la confrontation n'y
 * figure pas toujours.
 */
const AFTER_COMBAT = new Set([
  "turn_started",
  "turn_ended",
  "paid",
  "played",
  "activated",
  "moved",
  "channeled",
  "drew",
  "showdown_started",
  "combat_started",
]);

/**
 * Le champ de bataille du combat en train d'être raconté, pour que la caméra
 * s'en approche : du début du combat (règle 466) aux dégâts, morts, points et
 * prises de contrôle qui en découlent. Pendant l'arrêt de fin de combat, la
 * caméra reste sur place jusqu'à « Continuer ».
 */
export function combatInFocus(
  journal: EngineTold[],
  current: { index: number } | null,
  ack: Ack | null,
): number | null {
  const at = ack?.kind === "combat" ? ack.at : current?.index;
  if (at === undefined || at < 0 || at >= journal.length) return null;
  let start = -1;
  for (let index = at; index >= 0; index -= 1) {
    const type = eventType(journal[index]);
    if (type === "combat_started") {
      start = index;
      break;
    }
    if (AFTER_COMBAT.has(type)) return null;
  }
  if (start < 0) return null;
  return battlefieldOf(journal[start]);
}
