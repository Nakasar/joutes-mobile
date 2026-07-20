import type { CSSProperties, ReactNode } from "react";
import { KEYWORD_COLORS } from "../lib/riftbound-keywords";

// Palette de repli pour les mots-clés hors du mapping officiel (paires
// fond / texte, mode clair puis foncé géré via CSS var dans styles.css).
const FALLBACK_PALETTE = [
  "#226B5C",
  "#C22D6A",
  "#8EAD2A",
  "#6D6C6D",
  "#B45309",
  "#6D28D9",
];

function fallbackColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

// Luminance relative (approx. WCAG) pour choisir un texte lisible blanc/foncé.
function contrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 140 ? "#161616" : "#ffffff";
}

/**
 * Badge de mot-clé (glossaire), repris de `components/games/KeywordBadge.tsx`
 * côté web : pastille colorée selon le code couleur officiel, biseautée, ou en
 * forme de flèche (`shape="arrow"`). Peut être un lien (`onClick`/`href`).
 */
export function KeywordBadge({
  id,
  children,
  size = "inline",
  onClick,
  shape,
}: {
  id: string;
  children: ReactNode;
  size?: "heading" | "inline";
  onClick?: () => void;
  /** 'arrow' : chevron pointant vers la droite (ex. « Level 3 »). */
  shape?: "arrow";
}) {
  const hex = KEYWORD_COLORS[id] ?? fallbackColor(id);
  const isArrow = shape === "arrow";

  const outerStyle: CSSProperties = {
    backgroundColor: hex,
    color: contrastTextColor(hex),
  };
  if (isArrow) {
    outerStyle.clipPath = "polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%)";
  }

  const className = [
    "keyword-badge",
    isArrow ? "keyword-badge--arrow" : "keyword-badge--skew",
    size === "heading" ? "keyword-badge--heading" : "keyword-badge--inline",
    onClick ? "keyword-badge--link" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={className}
      style={outerStyle}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span className="keyword-badge__label">{children}</span>
    </span>
  );
}
