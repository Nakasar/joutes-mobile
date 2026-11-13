import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { KNOWN_BOOSTER_TYPES, boosterTypesFor, normalizeBoosterType } from "../api/boosters";
import type { Game } from "../api/types";

/**
 * Le libellé d'un type de booster : celui saisi dans l'administration du jeu,
 * sinon la traduction d'un type connu, sinon la clé telle quelle.
 */
export function useBoosterTypeLabel(game: Game | null | undefined) {
  const { t } = useTranslation();
  return useCallback(
    (raw: string) => {
      const key = normalizeBoosterType(raw);
      const custom = game ? boosterTypesFor(game).find((type) => type.key === key)?.label : undefined;
      if (custom) return custom;
      return KNOWN_BOOSTER_TYPES.includes(key) ? t(`boosters.types.${key}`) : key;
    },
    [game, t],
  );
}
