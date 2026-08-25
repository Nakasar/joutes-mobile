import type { PublicUser } from "../api/types";

/**
 * Identifiant d'URL d'un utilisateur : `{displayName}{discriminator}` sans
 * séparateur (un `#` littéral casserait le routage — même convention que le
 * site web), ou à défaut son id Mongo.
 *
 * **Pas de repli sur le `username`** : l'API ne sait résoudre que ces deux
 * formes-là (`getUserByTagOrId` : un identifiant, ou un tag avec son `#`). Un
 * nom de compte seul y arrivait en adresse que rien ne désigne, donc en 404 —
 * ce qui touchait tout compte sans pseudonyme personnalisé.
 */
export function userTag(user: PublicUser): string {
  if (user.displayName && user.discriminator) {
    return `${user.displayName}${user.discriminator}`;
  }
  return user.id;
}

/** Chemin `/users/:tag` prêt à l'emploi dans un `Link to=`, tag encodé. */
export function userProfilePath(user: PublicUser): string {
  return `/users/${encodeURIComponent(userTag(user))}`;
}

/** Étiquette lisible `Nom#1234` (ou le username seul si pas de discriminateur). */
export function userLabel(user: PublicUser, fallback = ""): string {
  if (user.displayName && user.discriminator) {
    return `${user.displayName}#${user.discriminator}`;
  }
  return user.username || user.displayName || fallback;
}
