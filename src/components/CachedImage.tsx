import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { getCachedImageUrl, prefetchImage } from "../lib/image-cache";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  /**
   * Ce qu'on montre si l'image ne vient pas. Sans lui, un `src` mort laissait
   * un cadre vide ou l'icône « image cassée » du navigateur, là où l'appelant
   * avait déjà écrit un repli — des initiales, un trophée — qu'il ne servait
   * que lorsque `src` était absent. Une URL morte est pourtant le cas le plus
   * courant : un lieu qui change de logo, une image retirée du stockage.
   */
  fallback?: ReactNode;
};

/**
 * `<img>` avec cache local : si l'image a déjà été mise en cache, on l'affiche
 * depuis IndexedDB (fonctionne hors ligne) ; sinon on charge l'URL réseau et on
 * la met en cache en arrière-plan pour les prochaines fois. Utilisé pour les
 * icônes de jeux et les bannières d'actualités.
 */
export function CachedImage({ src, fallback, onError, ...imgProps }: Props) {
  // Initialisé avec l'URL réseau pour afficher l'image immédiatement au premier
  // rendu ; la lecture async d'IndexedDB la remplace ensuite par l'object URL
  // en cache si disponible (évite un flicker / layout shift).
  const [resolved, setResolved] = useState<string | undefined>(src);
  // On retient **quelle** URL a échoué, pas qu'une a échoué.
  //
  // Un drapeau booléen restait allumé après coup : le premier rendu montre
  // l'URL réseau pendant qu'IndexedDB se lit, et si le réseau tombe avant que
  // la lecture ne réponde — c'est-à-dire hors ligne, précisément le cas pour
  // lequel ce cache existe — le repli s'affichait puis ne repartait plus, la
  // copie en cache arrivant sur un échec déjà noté.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedUrl(null);
    if (!src) {
      setResolved(undefined);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    getCachedImageUrl(src).then((cachedUrl) => {
      if (cancelled) {
        if (cachedUrl) URL.revokeObjectURL(cachedUrl);
        return;
      }
      if (cachedUrl) {
        objectUrl = cachedUrl;
        setResolved(cachedUrl);
      } else {
        // Pas encore en cache : on affiche le réseau et on mémorise pour plus tard.
        setResolved(src);
        void prefetchImage(src);
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!resolved) return <>{fallback ?? null}</>;

  // Sans repli déclaré, on laisse l'`<img>` en place et le navigateur faire ce
  // qu'il a toujours fait : retirer l'élément changerait la mise en page de
  // vingt-cinq appels qui n'ont rien demandé — une bannière réglée en hauteur
  // se replierait au lieu de rester un cadre.
  if (fallback !== undefined && failedUrl === resolved) return <>{fallback}</>;

  return (
    <img
      src={resolved}
      onError={(event) => {
        setFailedUrl(resolved);
        onError?.(event);
      }}
      {...imgProps}
    />
  );
}
