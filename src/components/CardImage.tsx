import type { ImgHTMLAttributes } from "react";
import { CachedImage } from "./CachedImage";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  /** Sens d'impression de la carte ; tout ce qui n'est pas `landscape` reste vertical. */
  orientation?: string;
  /** Passe par le cache local d'images (hors ligne), comme `CachedImage`. */
  cached?: boolean;
};

/**
 * Illustration d'une carte, quel que soit son sens d'impression.
 *
 * Les cartes paysage — les champs de bataille de Riftbound — ont une image plus
 * large que haute : posée dans une vignette au format portrait, elle y serait
 * rognée de part et d'autre du dessin. On la pivote donc d'un quart de tour,
 * comme le fait la galerie officielle : la carte occupe alors la même vignette
 * que les autres, et se lit en penchant la tête — ou l'écran. Le détail du
 * pivot est dans `.card-landscape` (styles.css).
 *
 * La vignette garde la classe que lui donne l'appelant : c'est elle qui porte
 * la taille, les coins et l'ombre, en portrait comme en paysage.
 */
export function CardImage({ src, orientation, cached, className, ...imgProps }: Props) {
  if (!src) return null;

  if (orientation !== "landscape") {
    return cached ? (
      <CachedImage src={src} className={className} {...imgProps} />
    ) : (
      <img src={src} className={className} {...imgProps} />
    );
  }

  return (
    <span className={`card-landscape${className ? ` ${className}` : ""}`}>
      {cached ? <CachedImage src={src} {...imgProps} /> : <img src={src} {...imgProps} />}
    </span>
  );
}
