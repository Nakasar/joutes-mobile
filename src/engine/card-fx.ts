/**
 * Les effets visuels des cartes sur la table. Deux choses se combinent :
 *
 * - le **geste**, lu dans les évènements du moteur : une carte qui inflige des
 *   dégâts frappe, une unité qui meurt s'efface en cendres, un bonus de
 *   Puissance fait monter une lueur… Rien n'est écrit carte par carte, et les
 *   capacités des unités en profitent aussi ;
 * - la **matière** de la carte (feu, éclair, comètes…), qui dit comment elle
 *   frappe et teinte ses autres gestes. Elle se déduit du nom du sort, de son
 *   champion ou de sa faction ; à défaut, c'est la couleur de son domaine.
 *
 * Ce module est pur : `components/play/TableFx.tsx` dessine ce qu'il décide.
 */

import type { EngineTold } from "./types";

export const MATTERS = [
  "eclair",
  "astral",
  "feu",
  "arcane",
  "lumiere",
  "explosif",
  "acier",
  "poing",
  "glace",
  "neant",
  "ombre",
  "vent",
  "domaine",
] as const;

export type Matter = (typeof MATTERS)[number];

/** La couleur dominante de chaque matière (`domaine` prend celle du domaine de la carte). */
export const MATTER_COLOR: Record<Exclude<Matter, "domaine">, string> = {
  eclair: "#a5d8ff",
  astral: "#fdba74",
  feu: "#fb923c",
  arcane: "#67e8f9",
  lumiere: "#fde68a",
  explosif: "#f59e0b",
  acier: "#e2e8f0",
  poing: "#fca5a5",
  glace: "#bae6fd",
  neant: "#c084fc",
  ombre: "#4ade80",
  vent: "#99f6e4",
};

/** Ce qu'il faut d'une carte du moteur pour lui trouver sa matière. */
export type FxCard = {
  name: string;
  kind: string;
  tags: string[];
};

/** Les mots du nom (anglais) qui disent la matière, dans l'ordre où on les essaie. */
const BY_NAME: [Matter, RegExp][] = [
  ["feu", /fire(?!-)|flame|burn|breath|incinerat|dragon|scorch|blaze|ember|inferno|hexplosive|detonat|fox-fire/],
  ["eclair", /lightning|storm|thunder|shock|zap|electr|tempest/],
  ["astral", /falling star|comet|meteor|icathian rain|moonfall|supernova|sky splitter|starfall|celestial/],
  ["lumiere", /smite|judgment|piercing light|radian|holy|divine|sunlight|solar|dawn/],
  ["arcane", /\bray\b|beam|spark|void seeker|disintegrat|arcane|hextech|magic|mystic/],
  ["explosif", /rocket|cannon|grenade|satchel|barrage|bullet|shot\b|harpoon|projectile|minefield|bomb|gun|shell\b/],
  [
    "acier",
    /blade|cleave|guillotine|slash|flourish|claw|lacerat|execution|strike(?!.*down)|crescent|skewer|sword|axe|spear|feathers|shuriken/,
  ],
  ["poing", /punch|wallop|thwonk|facebreaker|brawl|smash|rampage|clash|hammer|fist/],
  ["glace", /frigid|frost|\bice|freez|glacial|avalanche|winter|snow/],
  ["neant", /void|singularity|existential/],
  ["ombre", /shadow|death|dread|soul|curse|ruination|harrowing|realm of death|grave|demon|wraith|dust/],
  ["vent", /gust|wind|whirlwind|tornado|ride the/],
];

/** Les champions (par leur nom ou le titre de leur légende) et leur matière. */
const BY_CHAMPION: Partial<Record<Matter, string[]>> = {
  feu: ["Annie", "Ornn", "Fire Below the Mountain", "Brand"],
  eclair: ["Kennen", "Heart of the Tempest", "Volibear", "Relentless Storm"],
  astral: ["Diana", "Scorn of the Moon", "Aphelios", "Bard", "Aurelion Sol"],
  lumiere: ["Leona", "Radiant Dawn", "Kayle", "Lux", "Lady of Luminosity", "Taric", "Soraka", "Galio"],
  arcane: [
    "Ezreal", "Prodigal Explorer", "Viktor", "Herald of the Arcane", "Jayce", "Defender of Tomorrow", "Xerath",
    "Syndra", "Dark Child", "Mel", "Orianna", "Lady of Clockwork", "Karma", "Hwei", "Ahri", "Nine-Tailed Fox",
    "LeBlanc", "Deceiver", "Twisted Fate", "Ekko", "Boy Who Shattered Time", "Zilean", "Seraphine",
    "Starry-Eyed Songstress", "Sona", "Lulu", "Neeko", "Yuumi",
  ],
  explosif: [
    "Jinx", "Loose Cannon", "Ziggs", "Hexplosives Expert", "Caitlyn", "Piltover Enforcer", "Graves", "Miss Fortune",
    "Bounty Hunter", "Gangplank", "Rumble", "Mechanized Menace", "Jhin", "Virtuoso", "Lucian", "Purifier", "Akshan",
    "Vayne", "Teemo", "Swift Scout", "Heimerdinger", "Renata Glasc", "Chem-Baroness",
  ],
  acier: [
    "Darius", "Hand of Noxus", "Garen", "Might of Demacia", "Fiora", "Grand Duelist", "Master Yi", "Wuju Bladesman",
    "Wuju Master", "Irelia", "Blade Dancer", "Katarina", "Riven", "The Exile", "Jax", "Grandmaster at Arms",
    "Xin Zhao", "Jarvan IV", "Exemplar of Demacia", "Tryndamere", "Draven", "Glorious Executioner", "Renekton",
    "Butcher of the Sands", "Rengar", "Pridestalker", "Akali", "Rogue Assassin", "Ambessa", "Matriarch of War", "Sivir",
    "Battle Mistress", "Azir", "Emperor of the Sands", "Nilah", "Qiyana",
  ],
  poing: [
    "Vi", "Sett", "The Boss", "Lee Sin", "Blind Monk", "Blitzcrank", "Udyr", "Warwick", "Dr. Mundo", "Poppy",
    "Keeper of the Hammer", "Illaoi", "K'Sante", "Pride of Nazumah", "Rell", "Nasus", "Curator of the Sands",
  ],
  glace: ["Anivia", "Ashe", "Lissandra", "Sejuani"],
  neant: ["Kai'Sa", "Daughter of the Void", "Kha'Zix", "Voidreaver", "Rek'Sai", "Void Burrower", "Malzahar", "Kog'Maw"],
  ombre: [
    "Evelynn", "Agony's Embrace", "Karthus", "Mordekaiser", "Iron Revenant", "Zed", "Master of Shadows", "Nocturne",
    "Shen", "Eye of Twilight", "Vex", "Gloomist", "Swain", "Morgana", "Pyke", "Bloodharbor Ripper", "Kayn",
  ],
  vent: ["Yasuo", "Unforgiven", "Yone", "Janna"],
};

const CHAMPIONS = new Map<string, Matter>(
  Object.entries(BY_CHAMPION).flatMap(([matter, names]) => names.map((name) => [name, matter as Matter] as const)),
);

const BY_FACTION: Record<string, Matter> = {
  Dragon: "feu",
  "The Void": "neant",
  "Shadow Isles": "ombre",
  Freljord: "glace",
  "Mount Targon": "astral",
};

/** Choisies à la main : le nom tromperait, ou ne dit rien. */
const CHOSEN: Record<string, Matter> = {
  "Decisive Strike": "domaine",
  "Strike Down": "domaine",
  "Dragon Form": "domaine",
  "Death Mark": "ombre",
  "Shadow Dash": "ombre",
  Stupefy: "arcane",
  "Frigid Touch": "glace",
  "Rune Prison": "arcane",
  "Wind Wall": "vent",
  Gust: "vent",
  "Lightning Rush": "eclair",
};

function byName(name: string): Matter | null {
  const low = name.toLowerCase();
  for (const [matter, pattern] of BY_NAME) if (pattern.test(low)) return matter;
  return null;
}

/**
 * La matière d'une carte : choisie à la main, sinon le nom d'un sort, le
 * champion (son nom avant la virgule, ou un de ses tags), le nom d'une autre
 * carte, la faction ; à défaut, la couleur du domaine.
 */
export function matterOf(card: FxCard): Matter {
  if (CHOSEN[card.name]) return CHOSEN[card.name];
  if (card.kind === "rune" || card.kind === "battlefield") return "domaine";
  if (card.kind === "spell") {
    const named = byName(card.name);
    if (named) return named;
  }
  const champion = CHAMPIONS.get(card.name.split(",")[0].trim());
  if (champion) return champion;
  for (const tag of card.tags) {
    const tagged = CHAMPIONS.get(tag);
    if (tagged) return tagged;
  }
  if (card.kind !== "spell") {
    const named = byName(card.name);
    if (named) return named;
  }
  for (const tag of card.tags) if (BY_FACTION[tag]) return BY_FACTION[tag];
  return "domaine";
}

// ---------------------------------------------------------------------------
// Ce que la table dessine pour un évènement raconté.

/** Le style d'un effet : sa matière et sa couleur (celle du domaine pour `domaine`). */
export type FxStyle = { matter: Matter; color: string };

export type FxCommand =
  /** La carte qui se résout, montrée en grand au bord de la table, d'où partent ses effets. */
  | { kind: "cast"; def: number; seat: number | null; source: number | null; style: FxStyle; spell: boolean }
  /** Des dégâts, dessinés selon la matière, depuis la carte qui se résout (ou sans origine). */
  | { kind: "strike"; style: FxStyle; targets: { obj: number; amount: number }[]; fromCast: boolean }
  /** Les dégâts de combat : les deux camps se heurtent sur le champ de bataille. */
  | { kind: "clash"; bf: number | null; targets: { obj: number; amount: number }[] }
  | { kind: "die"; obj: number; style: FxStyle | null }
  | { kind: "might"; obj: number; delta: number; style: FxStyle | null }
  | { kind: "stun"; obj: number; style: FxStyle | null }
  | { kind: "shield"; obj: number; style: FxStyle | null }
  | { kind: "heal"; obj: number }
  | { kind: "move"; objs: number[]; style: FxStyle | null }
  | { kind: "vanish"; obj: number; banish: boolean; style: FxStyle | null }
  | { kind: "counter"; def: number; seat: number | null; style: FxStyle }
  | { kind: "summon"; obj: number; style: FxStyle | null }
  | { kind: "draw"; seat: number; count: number; style: FxStyle | null };

/** Ce qu'il faut savoir d'une définition de carte du moteur (son numéro dans `def`). */
export type FxDefs = (def: number) => { matter: Matter; color: string; spell: boolean } | null;

/** Ce qui ouvre une résolution (ses effets suivent) ou un combat. */
const OPENERS = new Set(["resolved", "combat_started"]);
/** Ce qui la referme : la partie reprend son cours. */
const CLOSERS = new Set([
  "played",
  "activated",
  "triggered",
  "turn_started",
  "turn_ended",
  "showdown_started",
  "paid",
  "countered",
  "spell_taken",
  "resolved",
  "combat_started",
]);

const num = (value: unknown): number | null => (typeof value === "number" ? value : null);
const type = (entry: EngineTold | undefined) => entry?.event.type ?? "";

/** La résolution (ou le combat) dont fait partie l'entrée `index`, s'il y en a une. */
export function windowOf(journal: EngineTold[], index: number): number | null {
  for (let at = index; at >= 0; at -= 1) {
    const kind = type(journal[at]);
    if (OPENERS.has(kind)) return at;
    if (at !== index && CLOSERS.has(kind)) return null;
  }
  return null;
}

/** Les entrées d'une résolution ouverte en `start` : jusqu'à ce que la partie reprenne son cours. */
export function windowEnd(journal: EngineTold[], start: number): number {
  let at = start + 1;
  while (at < journal.length && !CLOSERS.has(type(journal[at]))) at += 1;
  return at;
}

function styleAt(journal: EngineTold[], index: number, defs: FxDefs): FxStyle | null {
  const start = windowOf(journal, index);
  if (start === null || type(journal[start]) !== "resolved") return null;
  const def = num(journal[start].event.def);
  const info = def === null ? null : defs(def);
  return info ? { matter: info.matter, color: info.color } : null;
}

/** Le siège qui a joué ou activé la carte qui se résout, et l'objet d'où vient une capacité. */
function originOf(journal: EngineTold[], start: number, def: number): { seat: number | null; source: number | null } {
  for (let at = start - 1; at >= 0 && at >= start - 40; at -= 1) {
    const event = journal[at].event;
    if (event.def !== def) continue;
    if (event.type === "played") return { seat: num(event.seat), source: null };
    if (event.type === "activated" || event.type === "triggered") return { seat: num(event.seat), source: num(event.source) };
  }
  return { seat: null, source: null };
}

function damagesIn(journal: EngineTold[], from: number, to: number): { obj: number; amount: number }[] {
  const out: { obj: number; amount: number }[] = [];
  for (let at = from; at < to; at += 1) {
    const event = journal[at].event;
    if (event.type !== "damaged") continue;
    const obj = num(event.unit);
    const amount = num(event.amount);
    if (obj !== null && amount !== null) out.push({ obj, amount });
  }
  return out;
}

/**
 * Les effets à dessiner quand l'entrée `index` du journal passe au premier
 * plan. Une carte qui se résout montre d'un coup toutes ses frappes (les
 * dégâts racontés ensuite n'ajoutent rien) ; ses autres gestes viennent un par
 * un, avec le récit, teintés de sa matière.
 */
export function fxFor(journal: EngineTold[], index: number, defs: FxDefs, me: number | null): FxCommand[] {
  const entry = journal[index];
  if (!entry) return [];
  const event = entry.event;
  const style = () => styleAt(journal, index, defs);

  switch (event.type) {
    case "resolved": {
      const def = num(event.def);
      const info = def === null ? null : defs(def);
      if (def === null || !info) return [];
      const own: FxStyle = { matter: info.matter, color: info.color };
      const { seat, source } = originOf(journal, index, def);
      const targets = damagesIn(journal, index + 1, windowEnd(journal, index));
      const out: FxCommand[] = [{ kind: "cast", def, seat, source, style: own, spell: info.spell }];
      if (targets.length > 0) out.push({ kind: "strike", style: own, targets, fromCast: true });
      return out;
    }
    case "damaged": {
      const start = windowOf(journal, index);
      if (start !== null && type(journal[start]) === "resolved") return [];
      if (start !== null && type(journal[start]) === "combat_started") {
        // Les dégâts de combat sont infligés ensemble : on les dessine au premier.
        if (type(journal[index - 1]) === "damaged" && windowOf(journal, index - 1) === start) return [];
        let end = index;
        while (type(journal[end]) === "damaged") end += 1;
        return [{ kind: "clash", bf: num(journal[start].event.bf), targets: damagesIn(journal, index, end) }];
      }
      const obj = num(event.unit);
      const amount = num(event.amount);
      if (obj === null || amount === null) return [];
      return [{ kind: "strike", style: { matter: "domaine", color: "#f87171" }, targets: [{ obj, amount }], fromCast: false }];
    }
    case "died": {
      const obj = num(event.unit);
      return obj === null ? [] : [{ kind: "die", obj, style: style() }];
    }
    case "might_changed": {
      const obj = num(event.unit);
      const delta = num(event.delta);
      return obj === null || !delta ? [] : [{ kind: "might", obj, delta, style: style() }];
    }
    case "buffed": {
      const obj = num(event.unit);
      return obj === null ? [] : [{ kind: "might", obj, delta: 1, style: style() }];
    }
    case "stunned": {
      const obj = num(event.unit);
      return obj === null ? [] : [{ kind: "stun", obj, style: style() }];
    }
    case "prevented":
    case "saved": {
      const obj = num(event.unit);
      return obj === null ? [] : [{ kind: "shield", obj, style: style() }];
    }
    case "healed": {
      const obj = num(event.unit);
      return obj === null ? [] : [{ kind: "heal", obj }];
    }
    case "moved": {
      const objs = Array.isArray(event.units) ? event.units.filter((id): id is number => typeof id === "number") : [];
      // Un déplacement ordinaire (la partie suit son cours) n'a pas d'effet : seul celui d'une carte en a.
      const own = style();
      return objs.length === 0 || !own ? [] : [{ kind: "move", objs, style: own }];
    }
    case "recalled": {
      const obj = num(event.unit);
      const own = style();
      return obj === null || !own ? [] : [{ kind: "move", objs: [obj], style: own }];
    }
    case "returned_to_hand":
    case "banished": {
      const obj = num(event.obj);
      return obj === null ? [] : [{ kind: "vanish", obj, banish: event.type === "banished", style: style() }];
    }
    case "countered": {
      const def = num(event.def);
      const info = def === null ? null : defs(def);
      if (def === null || !info) return [];
      return [{ kind: "counter", def, seat: originOf(journal, index, def).seat, style: { matter: info.matter, color: info.color } }];
    }
    case "token_created": {
      const obj = num(event.obj);
      return obj === null ? [] : [{ kind: "summon", obj, style: style() }];
    }
    case "drew": {
      const seat = num(event.seat);
      const count = num(event.count) ?? 0;
      // Seulement ses propres pioches, et seulement celles d'une carte : pas la pioche du tour.
      const own = style();
      return seat === null || seat !== me || count === 0 || !own ? [] : [{ kind: "draw", seat, count, style: own }];
    }
    default:
      return [];
  }
}
