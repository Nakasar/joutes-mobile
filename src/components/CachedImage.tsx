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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
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

  if (!resolved || failed) return <>{fallback ?? null}</>;

  return (
    <img
      src={resolved}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
      {...imgProps}
    />
  );
}
