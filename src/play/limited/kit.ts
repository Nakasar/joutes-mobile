import type { ComponentType, ReactNode } from "react";

import type { MatchSeat } from "./useOnlineLimitedEvent";
import type { LimitedGame, LimitedView, Pulled } from "../../engine/limited";
import type { Faces } from "../../engine/limited-faces";
import type { LimitedProfile } from "../../engine/limited-profile";
import type { BotLevel } from "../../engine/types";

/** Ce que tout journal de partie porte : sa graine et ses actions. */
export type MatchRecord = { seed: number; actions: unknown[] };

/** La partie d'un match contre une IA, telle qu'elle est gardée dans le navigateur. */
export type MatchSave<R> = { index: number; bots: (BotLevel | null)[]; record: R };

export type BuildProps<D, C> = {
  view: LimitedView<D>;
  seat: number;
  cards: C;
  faces: Faces;
  deck: D;
  /** Vrai : le joueur a réglé lui-même ce que l'écran règle d'ordinaire pour lui (les runes de Riftbound). */
  byHand: boolean;
  /** Ce que le moteur reproche au deck ; vide s'il est légal. */
  problems: string[];
  onDeck: (deck: D, byHand: boolean) => void;
};

export type SoloMatchProps<C, R> = {
  save: MatchSave<R>;
  /** Ma place à la table du match (0 ou 1). */
  place: number;
  cards: C;
  note: string;
  /** Où mène le bouton de sortie de la table. */
  home: string;
  onRecord: (record: R) => void;
  /** La partie est finie : les places gagnantes de la table (aucune ou deux : nulle). */
  onResult: (winners: number[]) => void;
  afterResult: ReactNode;
};

export type OnlineMatchProps<C> = {
  table: MatchSeat;
  /** L'adresse WebSocket du serveur de parties. */
  server: string;
  cards: C;
  note: string;
  /** Où mène le bouton de sortie de la table. */
  home: string;
  afterResult: ReactNode;
};

/**
 * Le scellé et le draft d'un jeu : son profil, ses cartes et les écrans qui lui
 * sont propres. `D` est la forme d'un deck, `C` celle de ses cartes, `R` celle
 * du journal d'une partie, `G` celle de la configuration d'une partie.
 */
export type LimitedKit<D, C, R extends MatchRecord, G> = LimitedProfile & {
  /** Les cartes du jeu et leur forme commune ; un crochet, appelé à chaque rendu. */
  useCards(): { cards: C; faces: Faces };
  emptyDeck(): D;
  /** Le deck privé des cartes que la réserve n'a pas (une sauvegarde abîmée). */
  fitToPool(deck: D, pool: Pulled[]): D;
  /** Le journal vide de la partie d'un match contre une IA, moi à cette place. */
  soloRecord(game: LimitedGame<G>, place: number): R;
  /** Un Web Worker qui simule une partie : reçoit `{ id, config, seed, bots }`, rend `{ id, summary }`. */
  worker(): Worker;
  Build: ComponentType<BuildProps<D, C>>;
  /** Le deck joué, dans le bilan. */
  DeckSummary: ComponentType<{ deck: D; cards: C; faces: Faces }>;
  SoloMatch: ComponentType<SoloMatchProps<C, R>>;
  /** Absent pour un jeu qui ne se joue que contre des IA (`game` vaut `null`). */
  OnlineMatch?: ComponentType<OnlineMatchProps<C>>;
};
