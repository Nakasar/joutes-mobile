/**
 * Scellé et draft : les formes que le moteur écrit (`joutes-limited`, voir son
 * `docs/limite.md`) et les calculs que les écrans font autour d'un deck en
 * construction. Aucune règle ici : c'est le moteur qui dit si un deck est légal
 * (`LimitedEvent.check`).
 */

import type { TableCard, TableCards } from "./cards";
import type { BotLevel, EngineConfig, EngineDeckList, EngineRecord } from "./types";

export type LimitedKind = "sealed" | "draft";
export const LIMITED_KINDS: LimitedKind[] = ["sealed", "draft"];

/** Une carte sortie d'un booster. */
export type Pulled = { code: string; foil?: boolean };

export type LimitedSettings = {
  kind: LimitedKind;
  /** L'extension de chaque booster, dans l'ordre d'ouverture. */
  packs: string[];
  players: { name: string; bot: BotLevel | null }[];
};

export type LimitedPhase = "draft" | "build" | "play" | "done";

export type LimitedMatch = { seats: [number, number]; seed: number; done: boolean; winner: number | null };

export type LimitedSeat = {
  name: string;
  bot: BotLevel | null;
  /** Paquets qui l'attendent : il choisit encore. */
  waiting: number;
  cards: number;
  ready: boolean;
  out: boolean;
};

/** Ce qu'un joueur est seul à voir. `D` : la forme d'un deck dans le jeu de l'évènement. */
export type LimitedPrivate<D = EngineDeckList> = { seat: number; pack: Pulled[] | null; pool: Pulled[]; deck: D | null };

export type LimitedView<D = EngineDeckList> = {
  game: string;
  kind: LimitedKind;
  phase: LimitedPhase;
  /** Le tour de table en cours d'un draft : d'abord ceux de `prelude`, puis un par booster. */
  round: number;
  /** Nombre de boosters. */
  rounds: number;
  /** Tours de table qui précèdent les boosters (les leaders de Star Wars: Unlimited). */
  prelude?: number;
  packs: string[];
  pass_next: boolean;
  seq: number;
  seats: LimitedSeat[];
  matches: LimitedMatch[];
  bye: number | null;
  you?: LimitedPrivate<D>;
};

/** Le journal d'un évènement : de quoi le rouvrir à l'identique. */
export type LimitedRecord = { version: number; settings: LimitedSettings; seed: number; log: unknown[] };

/** La partie d'un match, telle que `LimitedEvent.game` la rend. */
export type LimitedGame<C = EngineConfig> = { config: C; seed: number; bots: (BotLevel | null)[] };

export type BoosterSet = { code: string; name: string; size: number; cards: number };

/** Un évènement contre des IA, tel qu'il est gardé dans le navigateur. */
export type LimitedSave<D = EngineDeckList, R = EngineRecord> = {
  record: LimitedRecord;
  /** Scellé : nombre de boosters déjà regardés. */
  opened?: number;
  /** Le deck en cours de construction, tant qu'il n'est pas rendu. */
  deck?: D;
  /** Vrai dès que le joueur a réparti ses runes lui-même. */
  runesByHand?: boolean;
  /** Le match du joueur, une fois lancé. */
  match?: { index: number; bots: (BotLevel | null)[]; record: R };
};

/** Les jeux qui ont un scellé et un draft : leur nom sur le serveur de parties, qui est aussi leur adresse. */
export const LIMITED_GAMES = ["riftbound", "swu"] as const;
export type LimitedGameKey = (typeof LIMITED_GAMES)[number];

export function isLimitedGame(value: unknown): value is LimitedGameKey {
  return (LIMITED_GAMES as readonly unknown[]).includes(value);
}

/** Les nombres d'un format, pour l'affichage et pour vérifier des réglages. */
export type LimitedRules = { boosters: number; minMain: number; packSize: number; picks: number };

export const LIMITED_STORAGE_KEY = "joutes.play.limited";

export const BLANK_LEGEND = "LIM-LEGEND";
export const BLANK_BATTLEFIELD = "LIM-BATTLEFIELD";

export const DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"] as const;
export type Domain = (typeof DOMAINS)[number];

/** Les couleurs des domaines, celles des maquettes. */
export const DOMAIN_COLORS: Record<Domain, string> = {
  fury: "#e5484d",
  calm: "#30a46c",
  mind: "#3b9eff",
  body: "#f5a524",
  chaos: "#a56eff",
  order: "#e9c53c",
};

export const RARITIES = ["common", "uncommon", "rare", "epic"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#9aa7b2",
  uncommon: "#5fd0c5",
  rare: "#f0b24a",
  epic: "#c58bff",
};

/** Les nombres du format (Tournament Rules 602.4), pour l'affichage seulement. */
export function limitedRules(kind: LimitedKind): LimitedRules {
  return kind === "sealed"
    ? { boosters: 6, minMain: 25, packSize: 14, picks: 0 }
    : { boosters: 3, minMain: 20, packSize: 13, picks: 39 };
}

export function readLimitedSave<D = EngineDeckList, R = EngineRecord>(key = LIMITED_STORAGE_KEY): LimitedSave<D, R> | null {
  try {
    const raw = window.localStorage.getItem(key);
    const save = raw ? (JSON.parse(raw) as Partial<LimitedSave<D, R>> | null) : null;
    // Une sauvegarde d'une autre forme est oubliée plutôt que de faire tomber la page.
    if (
      !save ||
      typeof save.record?.seed !== "number" ||
      !Array.isArray(save.record.log) ||
      !Array.isArray(save.record.settings?.players) ||
      !Array.isArray(save.record.settings.packs)
    ) {
      if (raw) window.localStorage.removeItem(key);
      return null;
    }
    return save as LimitedSave<D, R>;
  } catch {
    return null;
  }
}

export function writeLimitedSave<D = EngineDeckList, R = EngineRecord>(
  save: LimitedSave<D, R> | null,
  key = LIMITED_STORAGE_KEY,
): void {
  try {
    if (save) window.localStorage.setItem(key, JSON.stringify(save));
    else window.localStorage.removeItem(key);
  } catch {
    // Stockage refusé (navigation privée) : l'évènement se joue, sans reprise.
  }
}

/** Un deck vide : rien dans le deck principal, trois champs de bataille vierges. */
export function emptyDeck(): EngineDeckList {
  return {
    legend: "",
    champion: "",
    main: [],
    runes: [],
    battlefields: [BLANK_BATTLEFIELD, BLANK_BATTLEFIELD, BLANK_BATTLEFIELD],
    extra_legends: [],
  };
}

/** Les cartes du deck principal, champion choisi compris. */
export function mainCodes(deck: EngineDeckList): string[] {
  return deck.champion ? [deck.champion, ...deck.main] : [...deck.main];
}

/** Les cartes de la réserve que le deck prend. */
function usedCodes(deck: EngineDeckList): string[] {
  return [deck.legend, ...mainCodes(deck), ...deck.battlefields, ...(deck.extra_legends ?? [])].filter(
    (code) => code && code !== BLANK_LEGEND && code !== BLANK_BATTLEFIELD,
  );
}

/** Ce qui reste de la réserve une fois le deck servi, dans l'ordre de la réserve. */
export function leftInPool(pool: Pulled[], deck: EngineDeckList): Pulled[] {
  return leftAfter(pool, usedCodes(deck));
}

/** La réserve privée de ces cartes, un exemplaire par code donné, dans l'ordre de la réserve. */
export function leftAfter(pool: Pulled[], codes: string[]): Pulled[] {
  const used = new Map<string, number>();
  for (const code of codes) used.set(code, (used.get(code) ?? 0) + 1);
  const left: Pulled[] = [];
  // Une carte brillante part en dernier : elle reste visible dans la réserve.
  const ordered = [...pool.entries()].sort(([a, x], [b, y]) => Number(x.foil ?? false) - Number(y.foil ?? false) || a - b);
  const taken = new Set<number>();
  for (const [index, card] of ordered) {
    const count = used.get(card.code) ?? 0;
    if (count > 0) {
      used.set(card.code, count - 1);
      taken.add(index);
    }
  }
  pool.forEach((card, index) => {
    if (!taken.has(index)) left.push(card);
  });
  return left;
}

/** Le deck privé des cartes que la réserve n'a pas (une sauvegarde abîmée, par exemple). */
export function fitToPool(deck: EngineDeckList, pool: Pulled[]): EngineDeckList {
  const left = new Map<string, number>();
  for (const card of pool) left.set(card.code, (left.get(card.code) ?? 0) + 1);
  const take = (code: string): boolean => {
    const count = left.get(code) ?? 0;
    if (count <= 0) return false;
    left.set(code, count - 1);
    return true;
  };
  const legend = deck.legend && take(deck.legend) ? deck.legend : "";
  const champion = deck.champion && take(deck.champion) ? deck.champion : "";
  const main = deck.main.filter(take);
  const battlefields = deck.battlefields.map((code) =>
    code === BLANK_BATTLEFIELD || take(code) ? code : BLANK_BATTLEFIELD,
  );
  return { ...deck, legend, champion, main, battlefields, extra_legends: [] };
}

/** Une pile de cartes identiques. */
export type Stack = { code: string; count: number; foil: boolean };

/** Regroupe des cartes par code, dans l'ordre de leur première apparition. */
export function stacks(cards: Pulled[]): Stack[] {
  const byCode = new Map<string, Stack>();
  for (const card of cards) {
    const stack = byCode.get(card.code);
    if (stack) {
      stack.count += 1;
      stack.foil ||= card.foil === true;
    } else {
      byCode.set(card.code, { code: card.code, count: 1, foil: card.foil === true });
    }
  }
  return [...byCode.values()];
}

function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

function domainsOf(card: TableCard | undefined): Domain[] {
  return (card?.domains ?? []).filter(isDomain);
}

/** Les domaines que le deck touche : Légende, deck principal et runes (TR 602.4.a.3). */
export function deckDomains(deck: EngineDeckList, cards: TableCards): Domain[] {
  const found = new Set<Domain>();
  for (const code of [deck.legend, ...mainCodes(deck), ...deck.runes]) {
    for (const domain of domainsOf(cards[code])) found.add(domain);
  }
  return DOMAINS.filter((domain) => found.has(domain));
}

/** Les domaines des cartes du deck, sans les runes : ce que le joueur a choisi. */
export function chosenDomains(deck: EngineDeckList, cards: TableCards): Domain[] {
  return deckDomains({ ...deck, runes: [] }, cards);
}

/** Vrai si la carte entre dans un deck de ces domaines sans en ajouter un quatrième. */
export function fitsDomains(card: TableCard | undefined, domains: Domain[]): boolean {
  const all = new Set<Domain>([...domains, ...domainsOf(card)]);
  return all.size <= 3;
}

/** Le nombre de cartes par domaine ; une carte de deux domaines compte dans chacun. */
export function domainCounts(codes: string[], cards: TableCards): Record<Domain, number> {
  const counts = { fury: 0, calm: 0, mind: 0, body: 0, chaos: 0, order: 0 };
  for (const code of codes) for (const domain of domainsOf(cards[code])) counts[domain] += 1;
  return counts;
}

/** La courbe des coûts en énergie : huit colonnes, la dernière pour 7 et plus. */
export function costCurve(codes: string[], cards: TableCards): number[] {
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const code of codes) {
    const card = cards[code];
    if (card) curve[Math.min(card.energy, 7)] += 1;
  }
  return curve;
}

/** La rune de base de chaque domaine : la première du catalogue, comme dans le moteur. */
export function runeCodes(cards: TableCards): Partial<Record<Domain, string>> {
  const runes: Partial<Record<Domain, { code: string; def: number }>> = {};
  for (const card of Object.values(cards)) {
    if (card.kind !== "rune" || card.token || card.domains.length !== 1) continue;
    const domain = card.domains[0];
    if (!isDomain(domain)) continue;
    const def = card.def ?? Number.MAX_SAFE_INTEGER;
    if (!runes[domain] || def < runes[domain].def) runes[domain] = { code: card.code, def };
  }
  return Object.fromEntries(Object.entries(runes).map(([domain, rune]) => [domain, rune.code]));
}

export const RUNE_COUNT = 12;

/** Le nombre de runes de chaque domaine dans le deck. */
export function runeCounts(deck: EngineDeckList, cards: TableCards): Record<Domain, number> {
  return domainCounts(deck.runes, cards);
}

/**
 * Douze runes réparties selon ce que le deck demande : chaque carte pèse pour
 * son coût en Puissance plus un, partagé entre ses domaines ; un domaine joué
 * reçoit au moins une rune.
 */
export function splitRunes(deck: EngineDeckList, cards: TableCards): Record<Domain, number> {
  const share = { fury: 0, calm: 0, mind: 0, body: 0, chaos: 0, order: 0 };
  for (const code of mainCodes(deck)) {
    const card = cards[code];
    const domains = domainsOf(card);
    for (const domain of domains) share[domain] += (1 + (card?.power ?? 0)) / domains.length;
  }
  for (const domain of domainsOf(cards[deck.legend])) share[domain] += 0.001;
  const played = DOMAINS.filter((domain) => share[domain] > 0).slice(0, 3);
  const counts = { fury: 0, calm: 0, mind: 0, body: 0, chaos: 0, order: 0 };
  if (played.length === 0) return counts;
  const total = played.reduce((sum, domain) => sum + share[domain], 0);
  for (const domain of played) counts[domain] = Math.max(1, Math.floor((share[domain] / total) * RUNE_COUNT));
  const sum = () => played.reduce((all, domain) => all + counts[domain], 0);
  while (sum() > RUNE_COUNT) {
    const most = played.reduce((a, b) => (counts[b] > counts[a] ? b : a));
    counts[most] -= 1;
  }
  while (sum() < RUNE_COUNT) {
    const neediest = played.reduce((a, b) => (share[b] / (counts[b] + 1) > share[a] / (counts[a] + 1) ? b : a));
    counts[neediest] += 1;
  }
  return counts;
}

/** La liste de runes qui correspond à ces nombres. */
export function runesFrom(counts: Record<Domain, number>, cards: TableCards): string[] {
  const codes = runeCodes(cards);
  return DOMAINS.flatMap((domain) => {
    const code = codes[domain];
    return code ? Array.from({ length: counts[domain] }, () => code) : [];
  });
}

/** Ajoute une carte de la réserve au deck, à la place que son type lui donne. */
export function addToDeck(deck: EngineDeckList, card: TableCard): EngineDeckList {
  if (card.kind === "legend") return { ...deck, legend: card.code };
  if (card.kind === "battlefield") {
    const blank = deck.battlefields.indexOf(BLANK_BATTLEFIELD);
    if (blank >= 0) return { ...deck, battlefields: deck.battlefields.map((code, i) => (i === blank ? card.code : code)) };
    return deck.battlefields.length < 3 ? { ...deck, battlefields: [...deck.battlefields, card.code] } : deck;
  }
  if (card.kind === "rune") return deck;
  return { ...deck, main: [...deck.main, card.code] };
}

/** Retire un exemplaire d'une carte du deck principal (le champion choisi en dernier). */
export function removeFromMain(deck: EngineDeckList, code: string): EngineDeckList {
  const at = deck.main.lastIndexOf(code);
  if (at >= 0) return { ...deck, main: deck.main.filter((_, index) => index !== at) };
  return deck.champion === code ? { ...deck, champion: "" } : deck;
}

/** Choisit le champion parmi les cartes du deck ; l'ancien retourne dans le deck principal. */
export function chooseChampion(deck: EngineDeckList, code: string): EngineDeckList {
  const back = deck.champion ? [...deck.main, deck.champion] : [...deck.main];
  if (!code) return { ...deck, champion: "", main: back };
  const at = back.indexOf(code);
  if (at < 0) return deck;
  return { ...deck, champion: code, main: back.filter((_, index) => index !== at) };
}

/** Remet un champ de bataille vierge à cette place. */
export function clearBattlefield(deck: EngineDeckList, index: number): EngineDeckList {
  return { ...deck, battlefields: deck.battlefields.map((code, i) => (i === index ? BLANK_BATTLEFIELD : code)) };
}

/** Le siège qui gagne un match, d'après les gagnants de sa partie (sièges 0 et 1 de la table). */
export function matchWinner(match: LimitedMatch, winners: number[]): number | null {
  return winners.length === 1 ? (match.seats[winners[0]] ?? null) : null;
}

/** Le match de ce siège, s'il en a un. */
export function matchOf(view: Pick<LimitedView, "matches">, seat: number): { index: number; match: LimitedMatch } | null {
  const index = view.matches.findIndex((match) => match.seats.includes(seat));
  return index < 0 ? null : { index, match: view.matches[index] };
}
