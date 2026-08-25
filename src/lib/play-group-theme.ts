import type { CSSProperties } from "react";

/**
 * La marque blanche d'un groupe — portage de `lib/play-groups/theme.ts` de
 * joutes-app, pur et testé là-bas. Toute modification doit être reportée dans
 * les deux dépôts : le même groupe doit se reconnaître d'une surface à l'autre.
 *
 * Le premier plan est écrit en hexadécimal plutôt qu'en `oklch`, comme pour les
 * lieux : le reste de la feuille de style du mobile n'emploie pas `oklch`, et
 * les deux valeurs désignent les mêmes couleurs.
 */

/**
 * La palette fermée d'accents proposée aux groupes.
 *
 * Volontairement la même que celle des lieux : la mécanique de marque blanche
 * est identique des deux côtés. Elle est recopiée plutôt qu'importée pour ne
 * pas faire dépendre les groupes du module des lieux — les deux listes peuvent
 * diverger sans se casser.
 */
export const PLAY_GROUP_ACCENT_PALETTE = [
  "#A78BFA",
  "#22D3EE",
  "#D8A150",
  "#34D399",
  "#F87171",
] as const;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex;
}

/** La luminance relative (WCAG 2.1) — elle décide si le texte posé sur l'accent est sombre ou clair. */
function relativeLuminance(hex: string): number {
  const value = expandHex(hex);
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export type PlayGroupAccent = {
  /** L'accent tel qu'il est stocké, ou `null` si le groupe n'en a pas choisi. */
  color: string | null;
  /** Le style à poser sur le conteneur `.play-group-theme`. */
  style: CSSProperties;
};

export type PlayGroupThemeSource = {
  options?: { theme?: { accentColor?: string } };
};

/**
 * Traduit l'accent du groupe en variables CSS.
 *
 * Seules `--group-accent` et `--group-accent-foreground` sont posées : les
 * déclinaisons se dérivent en CSS dans `.play-group-theme`, sur le même
 * élément. Sans accent enregistré, rien n'est posé et chaque usage retombe sur
 * son repli.
 */
export function readPlayGroupAccent(group: PlayGroupThemeSource): PlayGroupAccent {
  const raw = group.options?.theme?.accentColor?.trim();
  const color = raw && HEX_COLOR.test(raw) ? expandHex(raw).toLowerCase() : null;

  if (!color) {
    return { color: null, style: {} };
  }

  const foreground = relativeLuminance(color) > 0.4 ? "#141210" : "#ffffff";

  return {
    color,
    style: {
      "--group-accent": color,
      "--group-accent-foreground": foreground,
    } as CSSProperties,
  };
}
