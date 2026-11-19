/**
 * Ce qui change d'un jeu à l'autre autour d'un scellé ou d'un draft, sans rien
 * d'écran : son adresse, ses nombres, et son moteur dans le navigateur. Les
 * écrans du jeu sont dans son `LimitedKit` (`components/play/limited/kit.ts`).
 */

import type { BoosterSet, LimitedGameKey, LimitedKind, LimitedRules, LimitedSettings } from "./limited";

/** Un évènement tenu par le moteur dans le navigateur (`LimitedEvent`, `SwuLimitedEvent`). */
export type LimitedHandle = {
  view(seat: number): string;
  act(seat: number, action: string): void;
  bot_step(): number;
  suggest(seat: number): string;
  check(seat: number, deck: string): string;
  game(index: number): string;
  report(index: number, winner: number): void;
  record(): string;
  free(): void;
};

export type LimitedEngine = {
  sets(): BoosterSet[];
  create(settings: LimitedSettings, seed: number): LimitedHandle;
  restore(record: string): LimitedHandle;
};

export type LimitedProfile = {
  /**
   * Le nom du jeu sur le serveur de parties, qui est aussi son adresse sur le
   * site ; `null` pour un jeu qui ne se joue que contre des IA.
   */
  game: LimitedGameKey | null;
  /** Où sont les phrases du jeu dans `Games.Limited` (« setup » pour Riftbound). */
  words: "setup" | "swu" | "cp";
  /** La page Jouer du jeu. */
  base: string;
  /** Où l'évènement contre des IA est gardé dans le navigateur. */
  storageKey: string;
  rules(kind: LimitedKind): LimitedRules;
  engine(): Promise<LimitedEngine>;
};
