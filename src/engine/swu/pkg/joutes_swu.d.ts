/* tslint:disable */
/* eslint-disable */
/**
 * Toutes les cartes de Star Wars: Unlimited connues du moteur, avec leur niveau
 * de prise en charge.
 */
export function swu_catalog(): string;
/**
 * Les problèmes d'un deck SWU au format Premier (liste vide s'il est valide).
 */
export function swu_validate_deck(deck_json: string): string;
/**
 * Un deck SWU valide construit au hasard autour d'un leader et d'une base
 * (leurs codes, « SOR-005 »), ou `null`.
 */
export function swu_auto_deck(leader: string, base: string, seed: number): string;
/**
 * Une configuration SWU complète avec deux decks au hasard.
 */
export function swu_random_config(seed: number): string;
/**
 * Joue une partie entière de SWU entre robots, comme [`simulate`]. Le
 * « score » du résumé est ce qu'il reste de PV à chaque base.
 */
export function swu_simulate(config: string, seed: number, bots: string): string;
/**
 * Arbitrage SWU : construit la situation décrite (JSON, voir `joutes_judge::swu::Scenario`),
 * y déroule les choix (`steps` : liste JSON d'indices) et rend le rapport.
 */
export function swu_judge_simulate(scenario: string, steps: string): string;
/**
 * Arbitrage d'une vraie partie de SWU : rejoue son journal jusqu'à l'action
 * `upto` (-1 = jusqu'au bout) et raconte les `last` dernières actions.
 */
export function swu_judge_review(record: string, upto: number, last: number): string;
/**
 * Version du moteur.
 */
export function version(): string;
/**
 * Une partie de Star Wars: Unlimited tenue dans le navigateur : les mêmes
 * appels que [`Table`], avec la configuration, les actions et la vue de SWU.
 */
export class SwuTable {
  free(): void;
  /**
   * Joue l'action d'un humain. Rend le numéro du premier évènement nouveau.
   */
  act(seat: number, action: string): number;
  /**
   * `config` : la configuration (JSON, deux joueurs). `bots` : un niveau par
   * siège (`"easy"`, `"normal"`, `"hard"`) ou `null` pour un humain.
   */
  constructor(config: string, seed: number, bots: string);
  seq(): number;
  is_bot(seat: number): boolean;
  /**
   * Le journal complet : configuration, graine et actions.
   */
  record(): string;
  /**
   * Le résultat (JSON) ou `null` si la partie continue.
   */
  result(): string;
  /**
   * Le siège qui doit décider, ou -1.
   */
  to_act(): number;
  /**
   * La table vue d'un siège (0, 1), d'un spectateur (-1) ou d'un arbitre (-2),
   * avec les évènements depuis `since`.
   */
  update(seat: number, since: number): string;
  /**
   * Rouvre une partie depuis son journal (`record()`).
   */
  static restore(record: string, bots: string): SwuTable;
  /**
   * Fait jouer un coup au robot dont c'est le tour. Rend -1 si personne ne joue.
   */
  bot_step(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_swutable_free: (a: number, b: number) => void;
  readonly swu_auto_deck: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly swu_catalog: () => [number, number];
  readonly swu_judge_review: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly swu_judge_simulate: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly swu_random_config: (a: number) => [number, number];
  readonly swu_simulate: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly swu_validate_deck: (a: number, b: number) => [number, number, number, number];
  readonly swutable_act: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly swutable_bot_step: (a: number) => number;
  readonly swutable_is_bot: (a: number, b: number) => number;
  readonly swutable_new: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly swutable_record: (a: number) => [number, number];
  readonly swutable_restore: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly swutable_result: (a: number) => [number, number];
  readonly swutable_seq: (a: number) => number;
  readonly swutable_to_act: (a: number) => number;
  readonly swutable_update: (a: number, b: number, c: number) => [number, number];
  readonly version: () => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
