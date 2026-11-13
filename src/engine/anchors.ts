import type { EngineAction, EngineChoice, EngineView } from "./types";

/**
 * Où un choix se fait sur la table. Le moteur publie la liste complète des
 * actions permises ; la table accroche chacune à ce qu'elle désigne (une
 * carte, un champ de bataille, un joueur…) et montre le reste en boutons.
 */
export type Anchor =
  | { on: "obj"; id: number }
  | { on: "bf"; index: number }
  | { on: "base"; seat: number }
  | { on: "seat"; seat: number }
  | { on: "item"; id: number };

const OBJ_FIELDS: Record<string, string> = {
  play: "card",
  hide: "card",
  activate: "source",
  move: "unit",
  exhaust_rune: "rune",
  recycle_rune: "rune",
  pick: "obj",
};

export function anchorOf(action: EngineAction): Anchor | null {
  const field = OBJ_FIELDS[action.type];
  if (field) {
    const id = action[field];
    return typeof id === "number" ? { on: "obj", id } : null;
  }
  if (action.type === "pick_bf" && typeof action.bf === "number") {
    return { on: "bf", index: action.bf };
  }
  if (action.type === "pick_seat" && typeof action.seat === "number") {
    return { on: "seat", seat: action.seat };
  }
  if (action.type === "pick_item" && typeof action.item === "number") {
    return { on: "item", id: action.item };
  }
  if (action.type === "pick_loc") {
    const loc = action.loc as { Base?: number; Bf?: number } | undefined;
    if (typeof loc?.Bf === "number") return { on: "bf", index: loc.Bf };
    if (typeof loc?.Base === "number") return { on: "base", seat: loc.Base };
  }
  return null;
}

export function anchorKey(anchor: Anchor): string {
  switch (anchor.on) {
    case "obj":
      return `obj:${anchor.id}`;
    case "bf":
      return `bf:${anchor.index}`;
    case "base":
      return `base:${anchor.seat}`;
    case "seat":
      return `seat:${anchor.seat}`;
    case "item":
      return `item:${anchor.id}`;
  }
}

/** Les objets que la table dessine pour ce spectateur : on ne peut cliquer que ceux-là. */
export function visibleObjects(view: EngineView): Set<number> {
  const ids = new Set<number>();
  for (const player of view.players) {
    ids.add(player.legend.id);
    for (const added of player.added_legends ?? []) ids.add(added.id);
    if (player.champion) ids.add(player.champion.id);
    for (const card of player.hand ?? []) ids.add(card.id);
  }
  for (const base of view.bases) {
    for (const obj of base) ids.add(obj.id);
  }
  for (const bf of view.battlefields) {
    ids.add(bf.card.id);
    for (const obj of bf.units) ids.add(obj.id);
    for (const obj of bf.facedown) ids.add(obj.id);
  }
  return ids;
}

export type SortedChoices = {
  /** Les choix accrochés à un élément dessiné, par clé d'ancre. */
  anchored: Map<string, EngineChoice[]>;
  /** Les autres : des boutons dans le panneau de la question. */
  buttons: EngineChoice[];
  /** Le mulligan se choisit carte par carte ; ses combinaisons ne sont pas des boutons. */
  mulligan: EngineChoice[];
};

export function sortChoices(choices: EngineChoice[], view: EngineView): SortedChoices {
  const visible = visibleObjects(view);
  const sorted: SortedChoices = { anchored: new Map(), buttons: [], mulligan: [] };
  for (const choice of choices) {
    if (choice.action.type === "mulligan") {
      sorted.mulligan.push(choice);
      continue;
    }
    const anchor = anchorOf(choice.action);
    // Une carte que la table ne montre pas (dessus de deck regardé, défausse) :
    // le choix reste possible, par son libellé.
    if (!anchor || (anchor.on === "obj" && !visible.has(anchor.id))) {
      sorted.buttons.push(choice);
      continue;
    }
    const key = anchorKey(anchor);
    const list = sorted.anchored.get(key);
    if (list) list.push(choice);
    else sorted.anchored.set(key, [choice]);
  }
  return sorted;
}

/** Le choix de mulligan qui met de côté exactement ces cartes. */
export function mulliganChoice(choices: EngineChoice[], selected: number[]): EngineChoice | null {
  const wanted = [...selected].sort((a, b) => a - b).join(",");
  return (
    choices.find((choice) => {
      const cards = Array.isArray(choice.action.cards) ? (choice.action.cards as number[]) : [];
      return [...cards].sort((a, b) => a - b).join(",") === wanted;
    }) ?? null
  );
}

/** Combien de cartes le mulligan permet de mettre de côté. */
export function mulliganLimit(choices: EngineChoice[]): number {
  return Math.max(0, ...choices.map((choice) => (Array.isArray(choice.action.cards) ? choice.action.cards.length : 0)));
}
