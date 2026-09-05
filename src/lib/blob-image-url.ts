/**
 * Copie de `lib/media/blob-image-url.ts` de joutes-app — toute modification
 * doit être reportée dans les deux dépôts.
 *
 * Une adresse d'image que l'application accepte d'afficher : seul le stockage
 * de Joutes est admis. Le suffixe se lit avec son point —
 * `evilpublic.blob.vercel-storage.com` n'est pas un sous-domaine du stockage.
 */
export function isAppBlobImageUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    (url.hostname === "blob.vercel-storage.com" ||
      url.hostname.endsWith(".public.blob.vercel-storage.com"))
  );
}
