import type { TournamentGameResult } from "../api/types";

/** Un raccourci de saisie : le score en manches qu'il représente et les parties à envoyer. */
export interface QuickResult {
  /** Identifiant stable, utilisable comme clé de rendu. */
  key: string;
  /** Manches gagnées par chacun des deux joueurs, dans l'ordre du match. */
  scores: [number, number];
  /** Index du vainqueur (0 ou 1), ou `null` pour une égalité. */
  winnerIndex: 0 | 1 | null;
  games: TournamentGameResult[];
}

/**
 * Raccourcis de saisie d'un duel, dérivés du best-of de la phase (même règle
 * que le portail joueur de joutes-app, `quickResults.ts`).
 *
 * Un best-of-n se gagne en `ceil(n/2)` manches : on énumère les scores où le
 * vainqueur atteint ce seuil, du plus net au plus serré, pour chaque joueur,
 * puis l'égalité. En best-of-1 l'égalité est une manche nulle ; au-delà, c'est
 * un partage des manches — ce que produit un tournoi chronométré.
 *
 * Ne s'applique qu'aux matchs à deux joueurs en mode « désignation du
 * vainqueur » : le mode « points » et les formats multijoueurs passent par la
 * saisie détaillée, partie par partie.
 */
export function buildQuickResults(bestOf: number, playerIds: string[]): QuickResult[] {
  if (playerIds.length !== 2) return [];

  const [a, b] = playerIds;
  const needed = Math.max(1, Math.ceil(bestOf / 2));
  const results: QuickResult[] = [];

  const winFor = (winner: string, loser: string, loserWins: number): TournamentGameResult[] => [
    ...Array.from({ length: needed }, () => ({ winnerId: winner })),
    ...Array.from({ length: loserWins }, () => ({ winnerId: loser })),
  ];

  for (const [winnerIndex, winner, loser] of [
    [0, a, b],
    [1, b, a],
  ] as const) {
    for (let loserWins = 0; loserWins < needed; loserWins++) {
      // Le total de manches ne peut pas dépasser le best-of.
      if (needed + loserWins > bestOf) continue;
      const scores: [number, number] =
        winnerIndex === 0 ? [needed, loserWins] : [loserWins, needed];
      results.push({
        key: `${scores[0]}-${scores[1]}`,
        scores,
        winnerIndex,
        games: winFor(winner, loser, loserWins),
      });
    }
  }

  // Égalité : une manche nulle en best-of-1, sinon des manches partagées.
  const drawGames: TournamentGameResult[] =
    bestOf < 2 ? [{ winnerId: null }] : [{ winnerId: a }, { winnerId: b }];
  const drawScore: [number, number] = bestOf < 2 ? [0, 0] : [1, 1];
  results.push({ key: "draw", scores: drawScore, winnerIndex: null, games: drawGames });

  return results;
}
