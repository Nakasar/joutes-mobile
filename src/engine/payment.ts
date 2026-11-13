import type { EngineAction, EngineLoc, EnginePayAbility, EnginePayment, EnginePower } from "./types.ts";

/**
 * Le paiement personnalisé : ce que le joueur choisit de faire de chaque rune
 * et de chaque capacité qui ajoute des ressources (Seal, Or), et s'il couvre le
 * coût. Le moteur revérifie tout ; ce calcul ne sert qu'à guider le joueur.
 */

/** Ordre des domaines dans `pool.power`, celui du moteur. */
export const POOL_DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"] as const;

/** Ce qu'on fait d'une rune : rien, l'épuiser, l'épuiser puis la recycler, la recycler. */
export type RuneUse = "none" | "exhaust" | "both" | "recycle";

export type PayChoice = {
  runes: Record<number, RuneUse>;
  /** Les capacités utilisées, par clé `source:capacité`. */
  abilities: string[];
};

export const abilityKey = (ability: Pick<EnginePayAbility, "source" | "ability">) =>
  `${ability.source}:${ability.ability}`;

/** La proposition du moteur, sous forme de choix modifiable. */
export function proposedChoice(payment: Pick<EnginePayment, "exhaust" | "recycle">): PayChoice {
  const runes: Record<number, RuneUse> = {};
  for (const id of payment.exhaust) runes[id] = "exhaust";
  for (const id of payment.recycle) runes[id] = runes[id] === "exhaust" ? "both" : "recycle";
  return { runes, abilities: [] };
}

/**
 * Le clic suivant sur une rune : épuiser, épuiser puis recycler, recycler,
 * rien. Une rune déjà épuisée ne peut plus que se recycler.
 */
export function nextRuneUse(use: RuneUse, exhausted: boolean): RuneUse {
  if (exhausted) return use === "recycle" ? "none" : "recycle";
  const order: RuneUse[] = ["none", "exhaust", "both", "recycle"];
  return order[(order.indexOf(use) + 1) % order.length];
}

/** L'action `pay` à envoyer au moteur. */
export function payAction(choice: PayChoice): EngineAction {
  const exhaust: number[] = [];
  const recycle: number[] = [];
  for (const [id, use] of Object.entries(choice.runes)) {
    if (use === "exhaust" || use === "both") exhaust.push(Number(id));
    if (use === "recycle" || use === "both") recycle.push(Number(id));
  }
  return {
    type: "pay",
    exhaust: exhaust.sort((a, b) => a - b),
    recycle: recycle.sort((a, b) => a - b),
    abilities: choice.abilities.map((key) => key.split(":").map(Number)),
  };
}

/** Un symbole de Puissance demandé : un domaine, « au choix », ou un domaine de la carte. */
export function powerKey(power: EnginePower, domains: string[]): string {
  if (power === "Any") return "any";
  if (power === "Card") return domains.length === 1 ? domains[0].toLowerCase() : "card";
  return power.Of.toLowerCase();
}

export type Gauge = { key: string; have: number; need: number };

export type Coverage = {
  energy: Gauge;
  /** Une jauge par sorte de Puissance demandée. */
  power: Gauge[];
  ok: boolean;
  /** Ce qui resterait dans la réserve, perdu à la fin de la phase. */
  extraEnergy: number;
  extraPower: number;
};

type Pool = { energy: number; power: number[]; wild?: number; spell_energy?: number; spell_wild?: number };

/** Ce que le choix met dans la réserve, et s'il couvre le coût. */
export function coverage(
  payment: EnginePayment,
  pool: Pool,
  runeDomain: (id: number) => string | null,
  choice: PayChoice,
  /** On paie un sort : les ressources réservées aux sorts comptent aussi. */
  spell = false,
): Coverage {
  const domains = payment.domains.map((domain) => domain.toLowerCase());
  let energy = pool.energy + (spell ? (pool.spell_energy ?? 0) : 0);
  // Les Puissances fournies, une par entrée : un domaine, ou « any ».
  const supply: string[] = [];
  POOL_DOMAINS.forEach((domain, index) => {
    for (let n = 0; n < (pool.power[index] ?? 0); n++) supply.push(domain);
  });
  const wild = (pool.wild ?? 0) + (spell ? (pool.spell_wild ?? 0) : 0);
  for (let n = 0; n < wild; n++) supply.push("any");
  for (const [id, use] of Object.entries(choice.runes)) {
    if (use === "exhaust" || use === "both") energy += 1;
    if (use === "recycle" || use === "both") supply.push(runeDomain(Number(id)) ?? "any");
  }
  for (const ability of payment.abilities) {
    if (!choice.abilities.includes(abilityKey(ability))) continue;
    energy += ability.energy;
    for (const power of ability.power) supply.push(power === "Any" ? "any" : powerKey(power, domains));
  }

  // Les exigences précises d'abord, « au choix » en dernier.
  const needs = payment.cost.power.map((power) => powerKey(power, domains));
  const rank = (key: string) => (key === "any" ? 2 : key === "card" ? 1 : 0);
  const gauges = new Map<string, Gauge>();
  const left = [...supply];
  for (const key of [...needs].sort((a, b) => rank(a) - rank(b))) {
    const gauge = gauges.get(key) ?? { key, have: 0, need: 0 };
    gauge.need += 1;
    gauges.set(key, gauge);
    const fits = (given: string) =>
      key === "any" ? true : key === "card" ? domains.includes(given) : given === key;
    let at = left.findIndex(fits);
    if (at < 0) at = left.indexOf("any");
    if (at >= 0) {
      left.splice(at, 1);
      gauge.have += 1;
    }
  }
  const power = [...gauges.values()];
  const need = payment.cost.energy;
  return {
    energy: { key: "energy", have: Math.min(energy, need), need },
    power,
    ok: energy >= need && power.every((gauge) => gauge.have >= gauge.need),
    extraEnergy: Math.max(0, energy - need),
    extraPower: left.length,
  };
}

/** Deux emplacements du moteur sont-ils le même ? */
export function sameLoc(a: EngineLoc | null | undefined, b: EngineLoc | null | undefined): boolean {
  if (!a || !b) return false;
  if ("Base" in a) return "Base" in b && a.Base === b.Base;
  return "Bf" in b && a.Bf === b.Bf;
}

/** La clé d'un emplacement, celle des ancres de la table (`base:0`, `bf:1`). */
export function locKey(loc: EngineLoc): string {
  return "Base" in loc ? `base:${loc.Base}` : `bf:${loc.Bf}`;
}
