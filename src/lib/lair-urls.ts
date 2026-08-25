import { isSafeUrl } from "./safe-url";

/**
 * Les URLs venues du lieu, avant de les poser dans le DOM — portage partiel de
 * `lib/lairs/urls.ts` de joutes-app. Toute modification doit être reportée dans
 * les deux dépôts.
 *
 * Un lieu renseigne lui-même son site, ses réseaux, les liens de ses annonces
 * et sa vidéo de présentation. Ces valeurs traversent la base et ressortent
 * dans des `href` : `javascript:` et `data:` y trouveraient une exécution au
 * clic. Le filtre est posé au rendu, et non seulement à l'écriture : il protège
 * aussi ce qui est déjà en base.
 *
 * **`embedVideoUrl` n'est pas porté.** Il traduit une adresse en URL de lecteur
 * pour une `iframe`, et le mobile n'en pose aucune : une vidéo de présentation
 * y est un lien qui ouvre l'application native de la plateforme, ce qui donne
 * un meilleur lecteur que celui qu'on intégrerait.
 */

/** L'URL si elle est en http(s), `null` sinon — y compris pour une chaîne vide. */
export function externalUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !isSafeUrl(trimmed)) {
    return null;
  }

  // `toString` normalise ce que le lieu a tapé — un `HTTPS://` ou un hôte en
  // majuscules ressort sous sa forme canonique.
  return new URL(trimmed).toString();
}
