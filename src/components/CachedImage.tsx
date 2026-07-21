import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { getCachedImageUrl, prefetchImage } from "../lib/image-cache";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
};

/**
 * `<img>` avec cache local : si l'image a déjà été mise en cache, on l'affiche
 * depuis IndexedDB (fonctionne hors ligne) ; sinon on charge l'URL réseau et on
 * la met en cache en arrière-plan pour les prochaines fois. Utilisé pour les
 * icônes de jeux et les bannières d'actualités.
 */
export function CachedImage({ src, ...imgProps }: Props) {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
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

  if (!resolved) return null;
  return <img src={resolved} {...imgProps} />;
}
