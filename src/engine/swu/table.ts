/**
 * Ce que la table Star Wars: Unlimited déduit d'une mise à jour du moteur :
 * quelles cartes portent quels choix, et quels identifiants sont sur la table.
 * Sans React, pour être testé seul.
 */

import type { SwuAction, SwuChoice, SwuPrompt, SwuTold, SwuView } from "./types";

/** La carte qui agit dans un choix : celle qu'on clique pour le faire. */
export function subjectOf(action: SwuAction): number | null {
  switch (action.type) {
    case "play":
    case "resource":
      return action.card;
    case "attack":
      return action.attacker;
    case "activate":
      return action.source;
    case "pick":
      return action.obj;
    default:
      return null;
  }
}

/** La carte visée par un choix qui demande une cible une fois sa carte choisie. */
export function targetOf(action: SwuAction): number | null {
  if (action.type === "attack") return action.target;
  if (action.type === "play") return action.on ?? null;
  return null;
}

/** Tous les objets visibles d'une vue : identifiant → code de carte. */
export function viewCodes(view: SwuView, known: Map<number, string> = new Map()): Map<number, string> {
  const note = (ref: { id: number; code?: string | null } | null | undefined) => {
    if (ref?.code) known.set(ref.id, ref.code);
  };
  for (const unit of [...view.ground, ...view.space]) {
    note(unit);
    unit.upgrades.forEach(note);
    unit.captives.forEach(note);
  }
  for (const player of view.players) {
    note(player.base);
    player.base.upgrades?.forEach(note);
    player.base.captives?.forEach(note);
    note(player.leader);
    player.hand?.forEach(note);
    player.discard.forEach(note);
    player.resource_cards?.forEach(note);
    note(player.deck_top);
  }
  return known;
}

/** Une ligne du récit, avec les cartes qu'elle nomme (leurs codes). */
export type SwuJournalEntry = SwuTold & { key: number; codes: string[] };

/**
 * Les évènements d'une mise à jour qui se racontent. `first` est le numéro du
 * premier évènement reçu : il sert de clé stable à chaque ligne. `known` donne
 * le code d'un objet de la partie, `byDef` celui d'une carte du catalogue.
 */
export function tellEvents(
  events: SwuTold[],
  first: number,
  known: Map<number, string>,
  byDef: Map<number, string>,
): SwuJournalEntry[] {
  return events
    .map((entry, index) => ({ entry, key: first + index }))
    .filter(({ entry }) => entry.text)
    .map(({ entry, key }) => {
      const codes = new Set<string>();
      for (const [field, value] of Object.entries(entry.event)) {
        if (typeof value !== "number") continue;
        const code = field === "def" ? byDef.get(value) : known.get(value);
        if (code) codes.add(code);
      }
      return { ...entry, key, codes: [...codes] };
    });
}

/** Les objets que la table dessine et qu'on peut donc cliquer, pour le joueur assis en `me`. */
export function clickableIds(view: SwuView, me: number): Set<number> {
  const ids = new Set<number>();
  for (const unit of [...view.ground, ...view.space]) {
    ids.add(unit.id);
    for (const upgrade of unit.upgrades) ids.add(upgrade.id);
  }
  for (const player of view.players) {
    ids.add(player.base.id);
    for (const upgrade of player.base.upgrades ?? []) ids.add(upgrade.id);
    ids.add(player.leader.id);
    if (player.seat === me) for (const card of player.hand ?? []) ids.add(card.id);
  }
  return ids;
}

export type ChoiceGroups = {
  /** Les choix portés par une carte de la table, par identifiant de cette carte. */
  bySubject: Map<number, SwuChoice[]>;
  /** Les autres : boutons de la barre, ou cartes hors de la table (deck regardé, défausse, ressources). */
  loose: SwuChoice[];
};

export function groupChoices(prompt: SwuPrompt | null, onTable: Set<number>): ChoiceGroups {
  const bySubject = new Map<number, SwuChoice[]>();
  const loose: SwuChoice[] = [];
  for (const choice of prompt?.choices ?? []) {
    const subject = subjectOf(choice.action);
    if (subject === null || !onTable.has(subject)) {
      loose.push(choice);
      continue;
    }
    const list = bySubject.get(subject) ?? [];
    list.push(choice);
    bySubject.set(subject, list);
  }
  return { bySubject, loose };
}

/** Un choix qui se joue d'un seul clic sur sa carte : désigner une cible, poser une ressource. */
export function isDirect(choices: SwuChoice[]): boolean {
  return choices.length === 1 && (choices[0].action.type === "pick" || choices[0].action.type === "resource");
}

/** Les cartes qu'un choix nomme : la sienne et celles que son action désigne. */
export function choiceCodes(choice: SwuChoice, codes: Map<number, string>): string[] {
  const out = new Set<string>();
  if (choice.card) out.add(choice.card);
  for (const value of Object.values(choice.action)) {
    const code = typeof value === "number" ? codes.get(value) : undefined;
    if (code) out.add(code);
  }
  return [...out];
}
