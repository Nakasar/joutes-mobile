/**
 * Table de jeu d'un rapport de bataille : la vue de dessus, ce qu'on y pose, et
 * les instants qu'on en garde.
 *
 * Trois idées portent tout le reste :
 *
 *  - **tout est en centimètres**, jamais en pixels. Une table est un objet
 *    physique : 90 × 90 cm pour Shatterpoint, et un socle de 4 cm en occupe
 *    toujours la même fraction, que la carte soit affichée sur un téléphone ou
 *    sur un écran de bureau. L'affichage n'a plus qu'à mettre ces centimètres à
 *    l'échelle.
 *  - **le décor appartient à la table, les unités à l'instant.** Un rapport
 *    garde une suite d'instants (« début de partie », « fin du tour 2 ») qui ne
 *    décrivent que les positions des unités : le décor, lui, est posé une fois
 *    pour toutes. Le dupliquer dans chaque instant obligerait à le corriger
 *    partout, pour un décor qui ne bouge pas de la partie.
 *  - **une position hors table n'est pas une erreur à refuser, mais à ramener
 *    au bord.** Un doigt qui glisse au-delà du plateau, une table rétrécie
 *    après coup : dans les deux cas, le jeton doit rester visible plutôt que de
 *    disparaître avec le rapport qu'il documentait.
 *
 * Module pur, sans accès à la base ni au DOM. Copie de
 * `lib/battle-reports/battle-map.ts` de joutes-app — le serveur normalise avec
 * le même code à l'enregistrement : toute modification doit être reportée dans
 * les deux dépôts, faute de quoi le mobile dessinerait une table que l'API
 * corrigerait dans son dos.
 */

import type {
  BattleMap,
  BattleMapShape,
  BattleMapSnapshot,
  BattleMapTerrain,
  BattleMapUnitToken,
} from "../api/types";

/** Les dimensions sont saisies en centimètres, jamais dans une autre unité. */
export const TABLE_UNIT = "cm";

export const MIN_TABLE_SIDE = 30;
export const MAX_TABLE_SIDE = 400;

/** Plus petit qu'un socle, un jeton n'est plus attrapable au doigt. */
export const MIN_TOKEN_SIZE = 1;

export const MAX_TERRAIN_PIECES = 60;
export const MAX_UNIT_TOKENS = 60;
export const MAX_SNAPSHOTS = 20;
export const MAX_LABEL_LENGTH = 60;

export const DEFAULT_TERRAIN_COLOR = "#000000";
export const DEFAULT_TERRAIN_SIZE = 20;
export const DEFAULT_TOKEN_DIAMETER = 4;

export const BATTLE_MAP_SHAPES: BattleMapShape[] = ["circle", "rectangle", "triangle"];

export const BATTLE_MAP_SHAPE_LABELS: Record<BattleMapShape, string> = {
  circle: "Rond",
  rectangle: "Rectangle",
  triangle: "Triangle",
};

/**
 * Couleurs distribuées aux joueurs dans l'ordre de la partie. Choisies pour
 * rester distinctes l'une de l'autre sur un fond clair comme sur un fond
 * sombre — un rapport se relit dans les deux thèmes.
 */
export const PLAYER_COLORS = [
  "#2563eb", // bleu
  "#dc2626", // rouge
  "#16a34a", // vert
  "#d97706", // ambre
  "#7c3aed", // violet
  "#0891b2", // cyan
];

export function playerColorAt(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

/** Table par défaut, quand le jeu n'en propose pas. */
export const DEFAULT_TABLE = { width: 120, height: 120 };

/**
 * Tables usuelles, par jeu. Ce ne sont que des valeurs de départ : chaque
 * rapport garde les siennes, et un scénario qui se joue sur une autre surface
 * se corrige en deux champs.
 */
export const GAME_TABLE_PRESETS: { gameSlugs: string[]; width: number; height: number }[] = [
  // Star Wars™: Shatterpoint — 3 × 3 pieds.
  { gameSlugs: ["shatterpoint"], width: 90, height: 90 },
  // Warhammer 40 000 et Warhammer — 60 × 44 pouces.
  { gameSlugs: ["w40k", "warhammer"], width: 152, height: 112 },
  // Star Wars: Legion — 6 × 3 pieds.
  { gameSlugs: ["legion"], width: 183, height: 91 },
];

export function defaultTableForGame(gameSlug: string | undefined): { width: number; height: number } {
  if (!gameSlug) {
    return { ...DEFAULT_TABLE };
  }

  const preset = GAME_TABLE_PRESETS.find((entry) => entry.gameSlugs.includes(gameSlug));
  return preset ? { width: preset.width, height: preset.height } : { ...DEFAULT_TABLE };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Arrondi au millimètre : au-delà, on stocke du bruit de souris. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeColor(color: string | undefined, fallback: string): string {
  const trimmed = color?.trim().toLowerCase();
  return trimmed && HEX_COLOR.test(trimmed) ? trimmed : fallback;
}

function normalizeLabel(label: string | undefined, fallback: string): string {
  const trimmed = label?.trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed || fallback;
}

export function normalizeTable(table: BattleMap["table"] | undefined): BattleMap["table"] {
  return {
    width: round(clamp(table?.width ?? DEFAULT_TABLE.width, MIN_TABLE_SIDE, MAX_TABLE_SIDE)),
    height: round(clamp(table?.height ?? DEFAULT_TABLE.height, MIN_TABLE_SIDE, MAX_TABLE_SIDE)),
  };
}

/**
 * Ramène une pièce de décor dans la table. La taille est bornée d'abord : un
 * décor plus grand que le plateau n'aurait aucun centre valable.
 */
function normalizeTerrain(piece: BattleMapTerrain, table: BattleMap["table"]): BattleMapTerrain {
  const width = round(clamp(piece.width, MIN_TOKEN_SIZE, table.width));
  const height = round(
    clamp(piece.shape === "circle" ? piece.height ?? piece.width : piece.height, MIN_TOKEN_SIZE, table.height)
  );
  const name = piece.name?.trim().slice(0, MAX_LABEL_LENGTH);

  return {
    id: piece.id,
    shape: BATTLE_MAP_SHAPES.includes(piece.shape) ? piece.shape : "rectangle",
    ...(name ? { name } : {}),
    color: normalizeColor(piece.color, DEFAULT_TERRAIN_COLOR),
    // Le centre reste sur la table ; un décor à cheval sur le bord est
    // fréquent (une ruine coupée par la limite de déploiement), on ne le
    // rentre donc pas de force tout entier.
    x: round(clamp(piece.x, 0, table.width)),
    y: round(clamp(piece.y, 0, table.height)),
    width,
    height,
  };
}

function normalizeUnitToken(
  token: BattleMapUnitToken,
  table: BattleMap["table"]
): BattleMapUnitToken {
  const smallestSide = Math.min(table.width, table.height);
  const image = token.image?.trim();
  const productId = token.productId?.trim();

  return {
    id: token.id,
    playerId: token.playerId,
    unitName: token.unitName.trim().slice(0, MAX_LABEL_LENGTH),
    ...(productId ? { productId } : {}),
    ...(image ? { image } : {}),
    x: round(clamp(token.x, 0, table.width)),
    y: round(clamp(token.y, 0, table.height)),
    diameter: round(clamp(token.diameter, MIN_TOKEN_SIZE, smallestSide)),
  };
}

/** Écarte les doublons d'identifiant, en gardant le premier venu. */
function byUniqueId<T extends { id: string }>(items: T[], limit: number): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];

  for (const item of items) {
    const id = item.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    kept.push(item);
    if (kept.length >= limit) break;
  }

  return kept;
}

function normalizeSnapshot(
  snapshot: BattleMapSnapshot,
  table: BattleMap["table"],
  playerIds: Set<string>,
  index: number
): BattleMapSnapshot {
  return {
    id: snapshot.id,
    label: normalizeLabel(snapshot.label, `Instant ${index + 1}`),
    units: byUniqueId(snapshot.units ?? [], MAX_UNIT_TOKENS)
      // Un jeton dont le joueur a quitté la partie n'a plus de couleur ni de
      // liste d'armée : il ne veut plus rien dire sur la table.
      .filter((token) => playerIds.has(token.playerId) && token.unitName?.trim())
      .map((token) => normalizeUnitToken(token, table)),
  };
}

/**
 * Nettoie une table entière avant écriture. `playerIds` est la liste des
 * joueurs de la partie : les couleurs et les jetons des autres sont abandonnés.
 */
export function normalizeBattleMap(map: BattleMap, playerIds: string[]): BattleMap {
  const table = normalizeTable(map.table);
  const players = new Set(playerIds);

  // Le repli suit le **rang du joueur dans la partie**, pas sa position dans
  // l'objet : c'est ce que lit l'affichage (`colorForPlayer`), et prendre
  // l'index de l'entrée donnerait au deuxième joueur la couleur du premier dès
  // qu'il est seul à en avoir une.
  const playerColors = Object.entries(map.playerColors ?? {})
    .filter(([playerId]) => players.has(playerId))
    .map(
      ([playerId, color]) =>
        [playerId, normalizeColor(color, playerColorAt(playerIds.indexOf(playerId)))] as const
    );

  return {
    table,
    terrain: byUniqueId(map.terrain ?? [], MAX_TERRAIN_PIECES).map((piece) =>
      normalizeTerrain(piece, table)
    ),
    snapshots: byUniqueId(map.snapshots ?? [], MAX_SNAPSHOTS).map((snapshot, index) =>
      normalizeSnapshot(snapshot, table, players, index)
    ),
    ...(playerColors.length > 0 ? { playerColors: Object.fromEntries(playerColors) } : {}),
  };
}

/** Une table sans décor, sans instant et aux dimensions par défaut n'a rien à dire. */
export function isEmptyBattleMap(map: BattleMap): boolean {
  return map.terrain.length === 0 && map.snapshots.every((snapshot) => snapshot.units.length === 0);
}

/**
 * Table de départ d'un rapport : les dimensions du jeu, et un premier instant
 * vide. Le rapport commence toujours par le placement initial — c'est ce que
 * l'outil sert d'abord à noter.
 */
export function emptyBattleMap(
  gameSlug: string | undefined,
  snapshotId: string,
  playerIds: string[]
): BattleMap {
  return {
    table: defaultTableForGame(gameSlug),
    terrain: [],
    snapshots: [{ id: snapshotId, label: "Début de partie", units: [] }],
    playerColors: Object.fromEntries(
      playerIds.map((playerId, index) => [playerId, playerColorAt(index)])
    ),
  };
}

/** Couleur d'un joueur : celle qu'il a choisie, sinon celle de son rang. */
export function colorForPlayer(
  map: Pick<BattleMap, "playerColors">,
  playerId: string,
  playerIndex: number
): string {
  return normalizeColor(map.playerColors?.[playerId], playerColorAt(playerIndex));
}

/**
 * Sommets d'un triangle inscrit dans sa boîte, pointe en haut. Rendu ici plutôt
 * que dans le composant : c'est de la géométrie, elle se teste.
 */
export function trianglePoints(piece: Pick<BattleMapTerrain, "x" | "y" | "width" | "height">): string {
  const halfWidth = piece.width / 2;
  const halfHeight = piece.height / 2;

  return [
    `${round(piece.x)},${round(piece.y - halfHeight)}`,
    `${round(piece.x + halfWidth)},${round(piece.y + halfHeight)}`,
    `${round(piece.x - halfWidth)},${round(piece.y + halfHeight)}`,
  ].join(" ");
}
