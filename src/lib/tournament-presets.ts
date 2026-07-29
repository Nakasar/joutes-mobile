/**
 * Presets de format livrés par jeu (statistiques de match et départages).
 *
 * Portage délibéré de `lib/tournaments/game-presets.ts` de joutes-app, comme
 * `tournament-timer.ts` ou `game-types.ts` : le serveur ne transmet que la clé
 * du preset (`TournamentPhase.statsPresetKey`), le client tient la table pour
 * pouvoir libeller les colonnes et les champs de saisie. Toute modification
 * doit être reportée dans les deux dépôts.
 */

export interface MatchStatDefinition {
  /** Identifiant stable, tel qu'il est stocké dans les résultats de parties. */
  key: string;
  /** Suffixe des clés i18n `tournaments.matchStats.<labelKey>` / `<labelKey>Short`. */
  labelKey: string;
  max: number;
}

export interface GameTournamentPreset {
  key: string;
  stats: MatchStatDefinition[];
}

const PRESETS: GameTournamentPreset[] = [
  {
    key: "swp-league",
    stats: [
      { key: "struggles", labelKey: "struggles", max: 10 },
      { key: "wounds", labelKey: "wounds", max: 99 },
    ],
  },
  {
    key: "victory-points",
    stats: [{ key: "victoryPoints", labelKey: "victoryPoints", max: 999 }],
  },
  {
    key: "blood-bowl",
    stats: [
      { key: "touchdowns", labelKey: "touchdowns", max: 99 },
      { key: "casualties", labelKey: "casualties", max: 99 },
    ],
  },
];

/**
 * Preset appliqué à une phase. Renvoie `undefined` quand la phase n'en utilise
 * pas, ou quand la clé vient d'une version du serveur plus récente que celle de
 * l'application : les colonnes disparaissent, rien ne casse.
 */
export function getPreset(key?: string | null): GameTournamentPreset | undefined {
  if (!key) return undefined;
  return PRESETS.find((preset) => preset.key === key);
}

/** Statistiques à saisir et à afficher pour une phase. Vide si aucun preset. */
export function presetStats(key?: string | null): MatchStatDefinition[] {
  return getPreset(key)?.stats ?? [];
}
