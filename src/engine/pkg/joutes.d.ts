/* tslint:disable */
/* eslint-disable */
/**
 * Toutes les cartes connues du moteur, avec leur niveau de prise en charge.
 */
export function catalog(): string;
/**
 * Les problèmes d'un deck (liste vide s'il est valide).
 */
export function validate_deck(deck_json: string): string;
/**
 * Un deck valide construit au hasard autour d'une légende, ou `null`.
 */
export function auto_deck(legend: string, seed: number): string;
/**
 * Une configuration complète avec des decks au hasard.
 */
export function random_config(mode_name: string, seed: number): string;
/**
 * Joue une partie entière entre robots (`bots` : un niveau par siège) et rend
 * son résumé (`joutes_session::GameSummary`). La même configuration, la même
 * graine et les mêmes niveaux redonnent la même partie sur une `Table`.
 *
 * L'appel est synchrone et dure de quelques millisecondes (Facile) à plusieurs
 * secondes (Difficile, ou plus de deux joueurs) : l'appeler depuis un Web Worker.
 */
export function simulate(config: string, seed: number, bots: string): string;
/**
 * Version du moteur.
 */
export function version(): string;
/**
 * Arbitrage : construit la situation décrite (JSON, voir `joutes_judge::Scenario`),
 * y déroule les choix (`steps` : liste JSON d'indices) et rend le rapport.
 */
export function judge_simulate(scenario: string, steps: string): string;
/**
 * Arbitrage d'une vraie partie : rejoue son journal jusqu'à l'action `upto`
 * (-1 = jusqu'au bout) et raconte les `last` dernières actions.
 */
export function judge_review(record: string, upto: number, last: number): string;
/**
 * Une partie tenue dans le navigateur.
 */
export class Table {
  free(): void;
  /**
   * Joue l'action d'un humain. Rend le numéro du premier évènement nouveau.
   */
  act(seat: number, action: string): number;
  /**
   * `config` : la configuration (JSON). `bots` : un niveau par siège
   * (`"easy"`, `"normal"`, `"hard"`) ou `null` pour un humain.
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
   * La table vue d'un siège (0, 1…), d'un spectateur (-1) ou d'un arbitre (-2),
   * avec les évènements depuis `since`.
   */
  update(seat: number, since: number): string;
  /**
   * Rouvre une partie depuis son journal (`record()`).
   */
  static restore(record: string, bots: string): Table;
  /**
   * Fait jouer un coup au robot dont c'est le tour. Rend -1 si personne ne joue.
   */
  bot_step(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_table_free: (a: number, b: number) => void;
  readonly auto_deck: (a: number, b: number, c: number) => [number, number];
  readonly catalog: () => [number, number];
  readonly judge_review: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly judge_simulate: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly random_config: (a: number, b: number, c: number) => [number, number, number, number];
  readonly simulate: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly table_act: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly table_bot_step: (a: number) => number;
  readonly table_is_bot: (a: number, b: number) => number;
  readonly table_new: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly table_record: (a: number) => [number, number];
  readonly table_restore: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly table_result: (a: number) => [number, number];
  readonly table_seq: (a: number) => number;
  readonly table_to_act: (a: number) => number;
  readonly table_update: (a: number, b: number, c: number) => [number, number];
  readonly validate_deck: (a: number, b: number) => [number, number, number, number];
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
