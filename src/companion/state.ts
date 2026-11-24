/**
 * Compagnon de partie : l'état d'une partie physique, jeu par jeu.
 *
 * Le téléphone posé entre les joueurs ne fait que compter. Rien ne part au
 * serveur : l'état vit dans le stockage du navigateur (ou de l'app), et ce
 * module n'en décrit que la forme et les transitions, sans React ni stockage,
 * pour se tester seul et se recopier tel quel dans l'app mobile.
 *
 * Chaque transition rend un nouvel état ; `withUndo` garde les précédents pour
 * le bouton « Annuler ».
 */

export const COMPANION_GAMES = ["riftbound", "swu", "mtg"] as const;
export type CompanionGame = (typeof COMPANION_GAMES)[number];

export function isCompanionGame(slug: string | undefined | null): slug is CompanionGame {
  return !!slug && (COMPANION_GAMES as readonly string[]).includes(slug);
}

/** Une carte retenue pour la partie : de quoi l'afficher, rien de plus. */
export type CompanionCard = {
  id: string;
  name: string;
  image?: string;
  /** Face arrière (leader de SWU déployé, côté unité). */
  backImage?: string;
  orientation?: "portrait" | "landscape";
  /** PV imprimés (base de SWU). */
  hp?: number;
};

/** Une entrée du journal : ce qui s'est passé, au tour où ça s'est passé. */
export type CompanionLogEntry = { turn: number; text: string };

const LOG_LIMIT = 60;
const UNDO_LIMIT = 50;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function withLog<T extends { log: CompanionLogEntry[] }>(state: T, turn: number, text: string): T {
  return { ...state, log: [...state.log, { turn, text }].slice(-LOG_LIMIT) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* ------------------------------------------------------------------ */
/* Annuler                                                            */
/* ------------------------------------------------------------------ */

/** Un état et ceux qui l'ont précédé, du plus ancien au plus récent. */
export type Undoable<T> = { present: T; past: T[] };

export function undoable<T>(present: T): Undoable<T> {
  return { present, past: [] };
}

/** Applique une transition en gardant l'état d'avant ; une transition sans effet n'empile rien. */
export function withUndo<T>(state: Undoable<T>, next: T): Undoable<T> {
  if (next === state.present) return state;
  return { present: next, past: [...state.past, state.present].slice(-UNDO_LIMIT) };
}

export function undo<T>(state: Undoable<T>): Undoable<T> {
  if (state.past.length === 0) return state;
  return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1) };
}

/* ------------------------------------------------------------------ */
/* Couleurs des joueurs                                               */
/* ------------------------------------------------------------------ */

/** Les couleurs de camp de la table de jeu (soi en cyan, l'autre en rose), puis d'autres. */
export const RIFTBOUND_COLORS = ["#2bb7dc", "#e0566b", "#e3b341", "#5fbf7a"] as const;
/** Celles de l'Holotable : bleu holo et orange adverse. */
export const SWU_COLORS = ["#5cc8ff", "#ff7a45", "#b48cff", "#7be0a0"] as const;
/** Une couleur de mana par joueur, puis l'incolore et l'or. */
export const MTG_COLORS = ["#e2553d", "#4a90d9", "#3fa66a", "#f3e9c6", "#8c7d9c", "#d8a93b"] as const;

/* ------------------------------------------------------------------ */
/* Riftbound                                                          */
/* ------------------------------------------------------------------ */

export type RiftboundMode = "duel" | "teams" | "melee";

/** Points de victoire par mode : 8 en duel et en mêlée, 11 en 2 contre 2. */
export const RIFTBOUND_TARGET: Record<RiftboundMode, number> = { duel: 8, teams: 11, melee: 8 };

export type RiftboundPlayer = {
  id: string;
  name: string;
  color: string;
  legend: CompanionCard | null;
  /** Les champs de bataille du deck (trois au plus). */
  battlefields: CompanionCard[];
  /** Celui qui est joué, par sa position dans `battlefields`. */
  chosen: number | null;
  /** Le deck d'où viennent légende et champs, pour le rappeler. */
  deckName?: string;
  score: number;
  holds: number;
  conquers: number;
  /** Compteurs de l'ancien suivi, rangés dans le menu. */
  energy: number;
  power: number;
};

export type RiftboundState = {
  game: "riftbound";
  mode: RiftboundMode;
  phase: "setup" | "playing" | "over";
  players: RiftboundPlayer[];
  /** Le joueur dont c'est le tour. */
  active: number;
  /** Celui qui a commencé : un tour complet revient à lui. */
  first: number;
  turn: number;
  /** Qui contrôle chaque champ de bataille en jeu, dans l'ordre des joueurs qui l'ont apporté. */
  control: (number | null)[];
  /** Le score de chacun à la fin de chaque tour, pour la courbe. */
  scoreByTurn: number[][];
  startedAt?: number;
  endedAt?: number;
  winner?: number;
  log: CompanionLogEntry[];
};

export function newRiftboundPlayer(index: number): RiftboundPlayer {
  return {
    id: newId(),
    name: "",
    color: RIFTBOUND_COLORS[index % RIFTBOUND_COLORS.length],
    legend: null,
    battlefields: [],
    chosen: null,
    score: 0,
    holds: 0,
    conquers: 0,
    energy: 0,
    power: 0,
  };
}

export function newRiftbound(mode: RiftboundMode = "duel"): RiftboundState {
  const count = mode === "teams" ? 4 : mode === "melee" ? 3 : 2;
  return {
    game: "riftbound",
    mode,
    phase: "setup",
    players: Array.from({ length: count }, (_, i) => newRiftboundPlayer(i)),
    active: 0,
    first: 0,
    turn: 1,
    control: [],
    scoreByTurn: [],
    log: [],
  };
}

export function riftboundTarget(state: Pick<RiftboundState, "mode">): number {
  return RIFTBOUND_TARGET[state.mode];
}

/** Change de mode en gardant les joueurs déjà renseignés. */
export function setRiftboundMode(state: RiftboundState, mode: RiftboundMode): RiftboundState {
  const count = mode === "teams" ? 4 : mode === "melee" ? Math.max(3, Math.min(4, state.players.length)) : 2;
  const players = Array.from({ length: count }, (_, i) => state.players[i] ?? newRiftboundPlayer(i));
  return { ...state, mode, players, first: Math.min(state.first, count - 1) };
}

export function setRiftboundPlayerCount(state: RiftboundState, count: number): RiftboundState {
  if (state.mode !== "melee") return state;
  const n = clamp(count, 3, 4);
  const players = Array.from({ length: n }, (_, i) => state.players[i] ?? newRiftboundPlayer(i));
  return { ...state, players, first: Math.min(state.first, n - 1) };
}

export function updateRiftboundPlayer(
  state: RiftboundState,
  index: number,
  patch: Partial<RiftboundPlayer>,
): RiftboundState {
  return { ...state, players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}

/**
 * Tire au sort le champ de bataille de chaque joueur parmi ceux de son deck,
 * comme en BO1. `random` est injecté pour les tests.
 */
export function drawBattlefields(state: RiftboundState, random: () => number = Math.random): RiftboundState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.battlefields.length === 0 ? p : { ...p, chosen: Math.floor(random() * p.battlefields.length) },
    ),
  };
}

export function drawFirstPlayer(state: RiftboundState, random: () => number = Math.random): RiftboundState {
  return { ...state, first: Math.floor(random() * state.players.length) };
}

/** Les champs de bataille en jeu : celui de chaque joueur qui en a choisi un. */
export function riftboundFieldsInPlay(state: RiftboundState): { card: CompanionCard; owner: number }[] {
  return state.players.flatMap((p, owner) => {
    const card = p.chosen === null ? undefined : p.battlefields[p.chosen];
    return card ? [{ card, owner }] : [];
  });
}

export function displayName(name: string, index: number): string {
  return name.trim() || `Joueur ${index + 1}`;
}

export function startRiftbound(state: RiftboundState, now: number): RiftboundState {
  const fields = riftboundFieldsInPlay(state);
  const started: RiftboundState = {
    ...state,
    phase: "playing",
    active: state.first,
    turn: 1,
    control: fields.map(() => null),
    scoreByTurn: [state.players.map(() => 0)],
    players: state.players.map((p) => ({ ...p, score: 0, holds: 0, conquers: 0, energy: 0, power: 0 })),
    startedAt: now,
    endedAt: undefined,
    winner: undefined,
    log: [],
  };
  return withLog(started, 1, `${displayName(state.players[state.first].name, state.first)} commence`);
}

export type RiftboundScoreKind = "hold" | "conquer" | "other";

/**
 * Un point de plus (ou de moins) pour un joueur. Atteindre l'objectif finit la
 * partie ; « Annuler » la rouvre.
 */
export function scoreRiftbound(
  state: RiftboundState,
  index: number,
  delta: 1 | -1,
  kind: RiftboundScoreKind,
  now: number,
): RiftboundState {
  if (state.phase !== "playing") return state;
  const target = riftboundTarget(state);
  const player = state.players[index];
  const score = clamp(player.score + delta, 0, target);
  if (score === player.score) return state;

  const name = displayName(player.name, index);
  const patch: Partial<RiftboundPlayer> = { score };
  if (delta > 0 && kind === "hold") patch.holds = player.holds + 1;
  if (delta > 0 && kind === "conquer") patch.conquers = player.conquers + 1;
  const text =
    delta < 0
      ? `${name} perd un point (${score})`
      : kind === "hold"
        ? `${name} tient un champ de bataille (${score})`
        : kind === "conquer"
          ? `${name} conquiert un champ de bataille (${score})`
          : `${name} marque un point (${score})`;

  let next = withLog(updateRiftboundPlayer(state, index, patch), state.turn, text);
  if (score >= target) {
    next = { ...next, phase: "over", winner: index, endedAt: now, scoreByTurn: [...next.scoreByTurn, next.players.map((p) => p.score)] };
    next = withLog(next, state.turn, `${name} l'emporte`);
  }
  return next;
}

/** Fait passer un champ de bataille au joueur suivant, puis libre. */
export function cycleRiftboundControl(state: RiftboundState, field: number): RiftboundState {
  if (state.phase !== "playing" || field < 0 || field >= state.control.length) return state;
  const current = state.control[field];
  const next = current === null ? 0 : current + 1 < state.players.length ? current + 1 : null;
  const control = state.control.map((c, i) => (i === field ? next : c));
  const card = riftboundFieldsInPlay(state)[field]?.card;
  const who = next === null ? "libre" : displayName(state.players[next].name, next);
  return withLog({ ...state, control }, state.turn, `${card?.name ?? "Champ de bataille"} : ${who}`);
}

/** Fin du tour du joueur actif : on note les scores, et le tour avance quand tout le monde a joué. */
export function endRiftboundTurn(state: RiftboundState): RiftboundState {
  if (state.phase !== "playing") return state;
  const active = (state.active + 1) % state.players.length;
  const turn = active === state.first ? state.turn + 1 : state.turn;
  const next: RiftboundState = {
    ...state,
    active,
    turn,
    scoreByTurn: [...state.scoreByTurn, state.players.map((p) => p.score)],
  };
  return withLog(next, turn, `À ${displayName(state.players[active].name, active)} de jouer`);
}

export function adjustRiftboundCounter(
  state: RiftboundState,
  index: number,
  counter: "energy" | "power",
  delta: number,
): RiftboundState {
  const player = state.players[index];
  return updateRiftboundPlayer(state, index, { [counter]: Math.max(0, player[counter] + delta) });
}

/** Revanche : mêmes joueurs, mêmes decks, champs retirés au sort, celui qui a perdu commence (duel). */
export function rematchRiftbound(state: RiftboundState, random: () => number = Math.random): RiftboundState {
  const loser = state.winner === undefined || state.players.length !== 2 ? state.first : 1 - state.winner;
  return drawBattlefields({ ...state, phase: "setup", first: loser, winner: undefined, endedAt: undefined }, random);
}

/** L'ancien suivi (`riftbound-tracker-state`) : une liste de joueurs avec score, énergie, puissance et légende. */
export function fromLegacyTracker(value: unknown): RiftboundState | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) return null;
  const valid = value.every(
    (p) => p && typeof p.name === "string" && typeof p.score === "number",
  );
  if (!valid) return null;
  const mode: RiftboundMode = value.length === 2 ? "duel" : value.length === 4 ? "teams" : "melee";
  const base = setRiftboundMode(newRiftbound("duel"), mode);
  const players = base.players.map((p, i) => {
    const old = value[i] as { name: string; score: number; energy?: number; power?: number; legend?: CompanionCard | null };
    return {
      ...p,
      name: old.name,
      legend: old.legend && typeof old.legend.id === "string" ? old.legend : null,
    };
  });
  return { ...base, players };
}

/* ------------------------------------------------------------------ */
/* Star Wars: Unlimited                                               */
/* ------------------------------------------------------------------ */

export type SwuFormat = "premier" | "twinSuns";

/** Une base sans carte connue : 30 PV, la valeur la plus courante. */
export const SWU_DEFAULT_BASE_HP = 30;

export type SwuPlayer = {
  id: string;
  name: string;
  color: string;
  leader: CompanionCard | null;
  base: CompanionCard | null;
  deckName?: string;
  damage: number;
  deployed: boolean;
  epicUsed: boolean;
  force: boolean;
};

export type SwuState = {
  game: "swu";
  format: SwuFormat;
  phase: "setup" | "playing" | "over";
  players: SwuPlayer[];
  /** Qui a le jeton d'initiative. */
  initiative: number;
  round: number;
  startedAt?: number;
  endedAt?: number;
  winner?: number;
  log: CompanionLogEntry[];
};

export function newSwuPlayer(index: number): SwuPlayer {
  return {
    id: newId(),
    name: "",
    color: SWU_COLORS[index % SWU_COLORS.length],
    leader: null,
    base: null,
    damage: 0,
    deployed: false,
    epicUsed: false,
    force: false,
  };
}

export function newSwu(format: SwuFormat = "premier"): SwuState {
  const count = format === "twinSuns" ? 3 : 2;
  return {
    game: "swu",
    format,
    phase: "setup",
    players: Array.from({ length: count }, (_, i) => newSwuPlayer(i)),
    initiative: 0,
    round: 1,
    log: [],
  };
}

export function swuMaxHp(player: Pick<SwuPlayer, "base">): number {
  const hp = player.base?.hp;
  return typeof hp === "number" && hp > 0 ? hp : SWU_DEFAULT_BASE_HP;
}

export function swuRemainingHp(player: SwuPlayer): number {
  return Math.max(0, swuMaxHp(player) - player.damage);
}

export function setSwuFormat(state: SwuState, format: SwuFormat): SwuState {
  const count = format === "twinSuns" ? Math.max(3, Math.min(4, state.players.length)) : 2;
  const players = Array.from({ length: count }, (_, i) => state.players[i] ?? newSwuPlayer(i));
  return { ...state, format, players, initiative: Math.min(state.initiative, count - 1) };
}

export function setSwuPlayerCount(state: SwuState, count: number): SwuState {
  if (state.format !== "twinSuns") return state;
  const n = clamp(count, 3, 4);
  const players = Array.from({ length: n }, (_, i) => state.players[i] ?? newSwuPlayer(i));
  return { ...state, players, initiative: Math.min(state.initiative, n - 1) };
}

export function updateSwuPlayer(state: SwuState, index: number, patch: Partial<SwuPlayer>): SwuState {
  return { ...state, players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}

export function drawSwuInitiative(state: SwuState, random: () => number = Math.random): SwuState {
  return { ...state, initiative: Math.floor(random() * state.players.length) };
}

export function startSwu(state: SwuState, now: number): SwuState {
  const started: SwuState = {
    ...state,
    phase: "playing",
    round: 1,
    players: state.players.map((p) => ({ ...p, damage: 0, deployed: false, epicUsed: false, force: false })),
    startedAt: now,
    endedAt: undefined,
    winner: undefined,
    log: [],
  };
  return withLog(started, 1, `${displayName(state.players[state.initiative].name, state.initiative)} a l'initiative`);
}

/**
 * Des dégâts sur une base (positif) ou un soin (négatif). Une base détruite
 * finit la partie à deux ; à plusieurs, le dernier debout l'emporte.
 */
export function damageSwuBase(state: SwuState, index: number, amount: number, now: number): SwuState {
  if (state.phase !== "playing") return state;
  const player = state.players[index];
  const max = swuMaxHp(player);
  const damage = clamp(player.damage + amount, 0, max);
  if (damage === player.damage) return state;
  const name = displayName(player.name, index);
  const left = max - damage;
  const text = amount > 0 ? `${name} : ${amount} dégât${amount > 1 ? "s" : ""} sur la base (${left})` : `${name} : soin de ${-amount} (${left})`;
  let next = withLog(updateSwuPlayer(state, index, { damage }), state.round, text);
  const standing = next.players.map((p, i) => ({ p, i })).filter(({ p }) => swuRemainingHp(p) > 0);
  if (standing.length === 1) {
    const winner = standing[0].i;
    next = withLog({ ...next, phase: "over", winner, endedAt: now }, state.round, `${displayName(next.players[winner].name, winner)} l'emporte`);
  }
  return next;
}

export function toggleSwu(state: SwuState, index: number, key: "deployed" | "epicUsed" | "force"): SwuState {
  if (state.phase !== "playing") return state;
  const player = state.players[index];
  const value = !player[key];
  const name = displayName(player.name, index);
  const text =
    key === "deployed"
      ? value
        ? `${name} déploie son leader`
        : `${name} : leader de retour côté leader`
      : key === "epicUsed"
        ? value
          ? `${name} utilise son action épique`
          : `${name} : action épique rendue`
        : value
          ? `${name} : la Force est avec vous`
          : `${name} utilise la Force`;
  return withLog(updateSwuPlayer(state, index, { [key]: value }), state.round, text);
}

export function passSwuInitiative(state: SwuState, to?: number): SwuState {
  if (state.phase !== "playing") return state;
  const initiative = to ?? (state.initiative + 1) % state.players.length;
  if (initiative === state.initiative) return state;
  return withLog({ ...state, initiative }, state.round, `${displayName(state.players[initiative].name, initiative)} prend l'initiative`);
}

/** Phase de regroupement passée : round suivant. */
export function nextSwuRound(state: SwuState): SwuState {
  if (state.phase !== "playing") return state;
  const round = state.round + 1;
  return withLog({ ...state, round }, round, `Round ${round}`);
}

export function rematchSwu(state: SwuState): SwuState {
  return { ...state, phase: "setup", winner: undefined, endedAt: undefined };
}

/* ------------------------------------------------------------------ */
/* Magic: The Gathering                                               */
/* ------------------------------------------------------------------ */

export type MtgFormat = "duel" | "commander" | "brawl" | "custom";

export const MTG_STARTING_LIFE: Record<Exclude<MtgFormat, "custom">, number> = { duel: 20, commander: 40, brawl: 25 };

/** Les compteurs qu'on peut afficher en plus des points de vie. */
export const MTG_COUNTERS = ["commander", "poison", "energy", "experience", "monarch"] as const;
export type MtgCounter = (typeof MTG_COUNTERS)[number];

export type MtgPlayer = {
  id: string;
  name: string;
  color: string;
  commander: CompanionCard | null;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  /** Dégâts reçus de chaque commandant adverse, par identifiant de joueur. */
  commanderDamage: Record<string, number>;
};

export type MtgState = {
  game: "mtg";
  format: MtgFormat;
  phase: "setup" | "playing" | "over";
  startingLife: number;
  players: MtgPlayer[];
  counters: MtgCounter[];
  monarch: string | null;
  startedAt?: number;
  endedAt?: number;
  log: CompanionLogEntry[];
};

export function newMtgPlayer(index: number, life: number): MtgPlayer {
  return {
    id: newId(),
    name: "",
    color: MTG_COLORS[index % MTG_COLORS.length],
    commander: null,
    life,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderDamage: {},
  };
}

export function newMtg(format: MtgFormat = "duel"): MtgState {
  const life = format === "custom" ? 20 : MTG_STARTING_LIFE[format];
  const count = format === "commander" ? 4 : 2;
  return {
    game: "mtg",
    format,
    phase: "setup",
    startingLife: life,
    players: Array.from({ length: count }, (_, i) => newMtgPlayer(i, life)),
    counters: format === "commander" ? ["commander", "poison"] : ["poison"],
    monarch: null,
    log: [],
  };
}

export function setMtgFormat(state: MtgState, format: MtgFormat): MtgState {
  const startingLife = format === "custom" ? state.startingLife : MTG_STARTING_LIFE[format];
  const count = format === "commander" && state.players.length < 3 ? 4 : state.players.length;
  const players = Array.from({ length: count }, (_, i) => state.players[i] ?? newMtgPlayer(i, startingLife));
  const counters: MtgCounter[] =
    format === "commander" || format === "brawl"
      ? [...new Set<MtgCounter>([...state.counters, "commander"])]
      : state.counters.filter((c) => c !== "commander");
  return { ...state, format, startingLife, players, counters };
}

export function setMtgStartingLife(state: MtgState, life: number): MtgState {
  return { ...state, format: "custom", startingLife: clamp(Math.round(life), 1, 999) };
}

export function setMtgPlayerCount(state: MtgState, count: number): MtgState {
  const n = clamp(count, 2, 6);
  const players = Array.from({ length: n }, (_, i) => state.players[i] ?? newMtgPlayer(i, state.startingLife));
  return { ...state, players };
}

export function updateMtgPlayer(state: MtgState, index: number, patch: Partial<MtgPlayer>): MtgState {
  return { ...state, players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)) };
}

export function toggleMtgCounter(state: MtgState, counter: MtgCounter): MtgState {
  const counters = state.counters.includes(counter)
    ? state.counters.filter((c) => c !== counter)
    : [...state.counters, counter];
  return { ...state, counters };
}

export function startMtg(state: MtgState, now: number): MtgState {
  return {
    ...state,
    phase: "playing",
    players: state.players.map((p) => ({ ...p, life: state.startingLife, poison: 0, energy: 0, experience: 0, commanderDamage: {} })),
    monarch: null,
    startedAt: now,
    endedAt: undefined,
    log: [],
  };
}

/** Le tour n'a pas de sens partagé à Magic : le journal note le moment, pas le tour. */
const MTG_TURN = 0;

export function changeMtgLife(state: MtgState, index: number, delta: number): MtgState {
  if (state.phase === "setup" || delta === 0) return state;
  const player = state.players[index];
  const life = player.life + delta;
  const name = displayName(player.name, index);
  return withLog(updateMtgPlayer(state, index, { life }), MTG_TURN, `${name} : ${delta > 0 ? "+" : ""}${delta} PV (${life})`);
}

export function changeMtgCounter(
  state: MtgState,
  index: number,
  counter: "poison" | "energy" | "experience",
  delta: number,
): MtgState {
  if (state.phase === "setup") return state;
  const player = state.players[index];
  const value = Math.max(0, player[counter] + delta);
  if (value === player[counter]) return state;
  return updateMtgPlayer(state, index, { [counter]: value });
}

/**
 * Dégâts du commandant de `from` sur `to` : ils comptent à part (21 font
 * perdre) et retirent aussi des points de vie.
 */
export function mtgCommanderDamage(state: MtgState, to: number, from: number, delta: number): MtgState {
  if (state.phase === "setup" || to === from) return state;
  const target = state.players[to];
  const source = state.players[from];
  const current = target.commanderDamage[source.id] ?? 0;
  const value = Math.max(0, current + delta);
  if (value === current) return state;
  const applied = value - current;
  const next = updateMtgPlayer(state, to, {
    commanderDamage: { ...target.commanderDamage, [source.id]: value },
    life: target.life - applied,
  });
  return withLog(
    next,
    MTG_TURN,
    `${displayName(source.name, from)} → ${displayName(target.name, to)} : ${applied > 0 ? "+" : ""}${applied} de commandant (${value})`,
  );
}

export function setMtgMonarch(state: MtgState, index: number | null): MtgState {
  const id = index === null ? null : state.players[index]?.id ?? null;
  return { ...state, monarch: state.monarch === id ? null : id };
}

/** Le joueur a-t-il perdu ? PV à 0, 10 poisons, ou 21 dégâts d'un même commandant. */
export function mtgIsOut(player: MtgPlayer): boolean {
  return player.life <= 0 || player.poison >= 10 || Object.values(player.commanderDamage).some((d) => d >= 21);
}

/* ------------------------------------------------------------------ */
/* Lecture du stockage                                                */
/* ------------------------------------------------------------------ */

export type CompanionState = RiftboundState | SwuState | MtgState;

export function newCompanion(game: CompanionGame): CompanionState {
  return game === "riftbound" ? newRiftbound() : game === "swu" ? newSwu() : newMtg();
}

export const COMPANION_STORAGE_VERSION = 1;

export function companionStorageKey(game: CompanionGame): string {
  return `joutes.companion.${game}`;
}

/** Clé de l'ancien suivi Riftbound, repris à la première ouverture. */
export const LEGACY_TRACKER_KEY = "riftbound-tracker-state";

/**
 * Relit un état enregistré. Tout ce qui n'a pas la forme attendue est écarté :
 * mieux vaut repartir d'une table vide que planter au milieu d'une partie.
 */
export function parseStoredCompanion(game: CompanionGame, raw: unknown): Undoable<CompanionState> | null {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw as { v?: unknown; present?: unknown; past?: unknown };
  if (stored.v !== COMPANION_STORAGE_VERSION) return null;
  const valid = (s: unknown): s is CompanionState =>
    !!s &&
    typeof s === "object" &&
    (s as CompanionState).game === game &&
    Array.isArray((s as CompanionState).players) &&
    Array.isArray((s as CompanionState).log);
  if (!valid(stored.present)) return null;
  const past = Array.isArray(stored.past) ? stored.past.filter(valid) : [];
  return { present: stored.present, past };
}

export function serializeCompanion(state: Undoable<CompanionState>): string {
  return JSON.stringify({ v: COMPANION_STORAGE_VERSION, present: state.present, past: state.past });
}

/** Ce que le tableau « Reprendre » montre d'une partie enregistrée. */
export function companionSummary(state: CompanionState): { score: string; detail: string } | null {
  if (state.phase === "setup") return null;
  const names = state.players.map((p, i) => displayName(p.name, i));
  if (state.game === "riftbound") {
    return {
      score: state.players.map((p, i) => `${names[i]} ${p.score}`).join(" – "),
      detail: state.players.map((p) => p.legend?.name.split(",")[0]).filter(Boolean).join(" contre ") || `Tour ${state.turn}`,
    };
  }
  if (state.game === "swu") {
    return {
      score: state.players.map((p, i) => `${names[i]} ${swuRemainingHp(p)}`).join(" – "),
      detail: `Round ${state.round}`,
    };
  }
  return {
    score: state.players.map((p, i) => `${names[i]} ${p.life}`).join(" – "),
    detail: state.format === "commander" ? "Commander" : `${state.startingLife} PV`,
  };
}
