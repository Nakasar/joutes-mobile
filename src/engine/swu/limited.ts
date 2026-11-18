/**
 * Scellé et draft de Star Wars: Unlimited (Comprehensive Rules, section 10) :
 * les nombres du format et les calculs que les écrans font autour d'un deck en
 * construction. Aucune règle ici : c'est le moteur qui dit si un deck est légal
 * (`SwuLimitedEvent.check`).
 */

import { leftAfter, type LimitedKind, type LimitedRules, type Pulled } from "../limited";
import type { SwuTableCard, SwuTableCards } from "./cards";
import type { SwuAspect, SwuDeckList, SwuRarity } from "./types";

/**
 * Les nombres du format (règles 10.2 et 10.3), pour l'affichage et pour vérifier
 * des réglages. Un booster compte 16 cartes ; en draft, son leader part dans le
 * tour des leaders et sa base commune n'est pas draftée : il en reste 14.
 */
export function swuLimitedRules(kind: LimitedKind): LimitedRules {
  return kind === "sealed"
    ? { boosters: 6, minMain: 30, packSize: 16, picks: 0 }
    : { boosters: 3, minMain: 30, packSize: 14, picks: 45 };
}

export const SWU_ASPECTS: SwuAspect[] = ["vigilance", "command", "aggression", "cunning", "heroism", "villainy"];

export const SWU_RARITIES: SwuRarity[] = ["common", "uncommon", "special", "rare", "legendary"];

export const SWU_RARITY_COLORS: Partial<Record<SwuRarity, string>> = { rare: "#f0b24a", legendary: "#c58bff" };

export function emptySwuDeck(): SwuDeckList {
  return { leader: "", base: "", cards: [] };
}

/** Les cartes qui entrent dans le deck : ni leader, ni base, ni jeton. */
export function isSwuMain(card: SwuTableCard | undefined): boolean {
  return card !== undefined && (card.kind === "unit" || card.kind === "event" || card.kind === "upgrade");
}

/** Ce qui reste de la réserve une fois le deck servi. Une base commune hors de la réserve n'y prend rien. */
export function leftInSwuPool(pool: Pulled[], deck: SwuDeckList): Pulled[] {
  return leftAfter(pool, [deck.leader, deck.base, ...deck.cards].filter(Boolean));
}

/**
 * Le deck privé des cartes que la réserve n'a pas (une sauvegarde abîmée). La
 * base est gardée telle quelle : une base commune ne vient pas de la réserve
 * (règle 10.2.2), et le moteur dira si celle-ci convient.
 */
export function fitSwuToPool(deck: SwuDeckList, pool: Pulled[]): SwuDeckList {
  const left = new Map<string, number>();
  for (const card of pool) left.set(card.code, (left.get(card.code) ?? 0) + 1);
  const take = (code: string): boolean => {
    const count = left.get(code) ?? 0;
    if (count <= 0) return false;
    left.set(code, count - 1);
    return true;
  };
  const leader = deck.leader && take(deck.leader) ? deck.leader : "";
  if (deck.base) take(deck.base);
  return { leader, base: deck.base, cards: deck.cards.filter(take) };
}

const setOf = (code: string) => code.split("-")[0];

/**
 * Les bases qu'un joueur peut prendre : celles qu'il a ouvertes, puis les bases
 * communes des extensions de sa réserve, qu'il a toutes à disposition (règle 10.2.2).
 */
export function swuBaseChoices(cards: SwuTableCards, pool: Pulled[]): string[] {
  const opened = [...new Set(pool.map((card) => card.code))].filter((code) => cards[code]?.kind === "base");
  const sets = new Set(pool.map((card) => setOf(card.code)));
  const common = Object.values(cards)
    .filter((card) => card.kind === "base" && card.rarity === "common" && card.playable && sets.has(setOf(card.code)))
    .map((card) => card.code)
    .filter((code) => !opened.includes(code))
    .sort();
  return [...opened, ...common];
}

/** Les icônes d'aspect du leader et de la base : ce que le deck joue sans pénalité. */
export function swuDeckAspects(deck: SwuDeckList, cards: SwuTableCards): SwuAspect[] {
  return [...(cards[deck.leader]?.aspects ?? []), ...(cards[deck.base]?.aspects ?? [])];
}

/**
 * Ce qu'une carte coûte en plus dans ce deck : 2 ressources par icône d'aspect
 * que ni le leader ni la base ne fournissent. Deux icônes du même aspect en
 * demandent deux.
 */
export function swuAspectPenalty(card: SwuTableCard | undefined, aspects: SwuAspect[]): number {
  if (!card) return 0;
  const have = [...aspects];
  let missing = 0;
  for (const aspect of card.aspects) {
    const at = have.indexOf(aspect);
    if (at >= 0) have.splice(at, 1);
    else missing += 1;
  }
  return 2 * missing;
}

/** La courbe des coûts, pénalité d'aspect comprise : huit colonnes, la dernière pour 7 et plus. */
export function swuCostCurve(deck: SwuDeckList, cards: SwuTableCards): number[] {
  const aspects = swuDeckAspects(deck, cards);
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const code of deck.cards) {
    const card = cards[code];
    if (card) curve[Math.min(card.cost + swuAspectPenalty(card, aspects), 7)] += 1;
  }
  return curve;
}

/** Ajoute une carte de la réserve au deck, à la place que son type lui donne. */
export function addToSwuDeck(deck: SwuDeckList, card: SwuTableCard): SwuDeckList {
  if (card.kind === "leader") return { ...deck, leader: card.code };
  if (card.kind === "base") return { ...deck, base: card.code };
  return isSwuMain(card) ? { ...deck, cards: [...deck.cards, card.code] } : deck;
}

/** Retire un exemplaire d'une carte du deck. */
export function removeFromSwuDeck(deck: SwuDeckList, code: string): SwuDeckList {
  const at = deck.cards.lastIndexOf(code);
  return at < 0 ? deck : { ...deck, cards: deck.cards.filter((_, index) => index !== at) };
}
