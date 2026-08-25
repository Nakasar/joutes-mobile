import { CachedImage } from "./CachedImage";
import { readPlayGroupAccent } from "../lib/play-group-theme";

/**
 * L'écu d'un groupe : ses initiales sur son accent, cerné d'un filet d'or.
 *
 * Portage de `app/[locale]/(app)/play-groups/explore/Escu.tsx` de joutes-app —
 * **toute modification doit être reportée dans les deux dépôts**, la forme
 * héraldique étant la même des deux côtés.
 *
 * Le blason plutôt que l'emblème téléversé, et pour une raison de fond : tous
 * les groupes n'ont pas d'emblème, et une liste où une ligne sur deux montre un
 * carré vide ne ressemble à rien. L'écu, lui, existe toujours — deux lettres et
 * une couleur suffisent à le dessiner. Quand le groupe a téléversé un emblème,
 * il vient le remplir, découpé à la forme de l'écu.
 *
 * **Écart assumé avec le web** : là-bas les initiales sont noires à 80 %, ici
 * elles suivent `--group-accent-foreground`, que `readPlayGroupAccent` calcule
 * sur la luminance. Un accent sombre — et la palette en propose — rendrait des
 * initiales noires illisibles ; c'est la correction déjà appliquée à
 * `.group-crest--initials`, et l'écu n'a pas de raison d'y échapper.
 *
 * L'écu est `aria-hidden` : il redit le nom qui le suit, et l'oriflamme du
 * direct redit le cri de l'entrée (« X diffuse en ce moment »). Rien ne se perd.
 */
export function GroupEscu({
  initials,
  logo,
  accentColor,
  live,
  liveLabel,
  size = "md",
}: {
  initials: string;
  logo?: string | null;
  accentColor?: string | null;
  /** L'oriflamme rouge en travers de l'écu, quand le groupe diffuse. */
  live?: boolean;
  liveLabel?: string;
  size?: "sm" | "md" | "lg";
}) {
  const accent = readPlayGroupAccent({
    options: { theme: { accentColor: accentColor ?? undefined } },
  });

  return (
    <span className={`escu escu--${size}`} style={accent.style} aria-hidden>
      <span className="escu__field">
        {logo ? (
          <CachedImage src={logo} alt="" className="escu__logo" />
        ) : (
          <b className="escu__initials">{initials}</b>
        )}
      </span>

      {live && liveLabel && <span className="escu__live">{liveLabel}</span>}
    </span>
  );
}
