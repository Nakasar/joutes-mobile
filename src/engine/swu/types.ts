/**
 * Ce que le moteur de Star Wars: Unlimited échange avec la table, tel qu'il
 * l'écrit en JSON (dépôt joutes-engine, crate `joutes-swu`).
 */

import type { BotLevel } from "../types";

export type SwuKind =
  | "leader"
  | "base"
  | "unit"
  | "event"
  | "upgrade"
  | "token_unit"
  | "token_upgrade"
  | "force_token"
  | "credit_token";

export type SwuAspect = "vigilance" | "command" | "aggression" | "cunning" | "heroism" | "villainy";

/** Une carte du catalogue du moteur (`swu_catalog`). */
export type SwuEngineCard = {
  id: number;
  code: string;
  name: string;
  subtitle?: string | null;
  kind: SwuKind;
  unique: boolean;
  aspects: SwuAspect[];
  traits: string[];
  arena: "ground" | "space" | null;
  cost: number;
  power: number;
  hp: number;
  text?: string;
  epic?: string;
  back?: string;
  coverage: "full" | "none" | { partial: string };
};

/** Un deck au format Premier : un leader, une base, et le reste. */
export type SwuDeckList = { leader: string; base: string; cards: string[] };

export type SwuConfig = { players: { name: string; deck: SwuDeckList }[] };

export type SwuAction =
  | { type: "play"; card: number; on?: number }
  | { type: "attack"; attacker: number; target: number }
  | { type: "activate"; source: number; ability: number }
  | { type: "pick"; obj: number }
  | { type: "pick_player"; seat: number }
  | { type: "option"; index: number }
  | { type: "number"; n: number }
  | { type: "name"; def: number }
  | { type: "resource"; card: number }
  | { type: "give_initiative"; seat: number }
  | {
      type: "take_initiative" | "pass" | "yes" | "no" | "done" | "skip_resource" | "mulligan" | "keep" | "concede";
    };

export type SwuRecord = { version?: number; config: SwuConfig; seed: number; actions: unknown[] };

/** `cost` : ce que la carte coûterait maintenant, pour une carte de la main. */
export type SwuCardRef = { id: number; code: string; name: string; cost?: number };

/** Un mot-clé d'une unité : `"sentinel"`, ou `{ raid: 2 }` quand il porte un nombre. */
export type SwuKeyword = string | Record<string, number>;

export type SwuUpgrade = SwuCardRef & { controller: number };

export type SwuUnit = SwuCardRef & {
  owner: number;
  controller: number;
  arena: "ground" | "space";
  leader: boolean;
  token: boolean;
  exhausted: boolean;
  damage: number;
  power: number;
  hp: number;
  keywords: SwuKeyword[];
  upgrades: SwuUpgrade[];
  captives: SwuCardRef[];
};

export type SwuBase = SwuCardRef & {
  damage: number;
  hp: number;
  epic_used: boolean;
  captives?: SwuCardRef[];
  upgrades?: SwuUpgrade[];
};

export type SwuLeader = SwuCardRef & {
  deployed: boolean;
  flipped?: boolean;
  attached_to?: number | null;
  exhausted: boolean;
  epic_used: boolean;
};

export type SwuPlayer = {
  seat: number;
  name: string;
  base: SwuBase;
  leader: SwuLeader;
  hand_count: number;
  /** `null` pour une main qu'on ne voit pas. */
  hand: SwuCardRef[] | null;
  deck_count: number;
  discard: SwuCardRef[];
  resources: number;
  resources_ready: number;
  resource_cards: SwuCardRef[] | null;
  force: boolean;
  credits: number;
  deck_top?: SwuCardRef | null;
};

/** `deploy` : le choix déploie le leader (son action épique). */
export type SwuChoice = { action: SwuAction; label: string; card?: string | null; deploy?: boolean };

export type SwuPrompt = { kind: string; text: string; card?: string | null; choices: SwuChoice[] };

export type SwuResult = { winners: number[]; reason?: string } | Record<string, unknown>;

export type SwuView = {
  viewer: unknown;
  round: number;
  phase: string;
  initiative: number;
  initiative_taken: boolean;
  active: number;
  players: SwuPlayer[];
  ground: SwuUnit[];
  space: SwuUnit[];
  attack: [number, number] | null;
  to_act: number | null;
  decision?: unknown;
  result: SwuResult | null;
};

export type SwuEvent = { type: string; [key: string]: unknown };

export type SwuTold = { event: SwuEvent; text: string; rule?: string | null };

export type SwuUpdate = { seq: number; view: SwuView; events: SwuTold[]; prompt: SwuPrompt | null };

/** Rapport d'arbitrage (`joutes_judge::swu`). */
export type SwuJudgeReport = {
  summary: string;
  steps: { player: string; question: string; chose: string }[];
  events: SwuTold[];
  asked:
    | (SwuPrompt & {
        seat: number;
        player: string;
        unplayable: { card: string; name: string; reason: string; rule: string | null }[];
      })
    | null;
  result: SwuResult | null;
  rules: string[];
  notes: string[];
  table: SwuView;
};

export type { BotLevel };
