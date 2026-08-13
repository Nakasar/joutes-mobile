/**
 * Traduit la destination d'une notification en route de l'application.
 *
 * Le serveur donne un chemin du **site** (`/lairs/xxx`, `/events/xxx`), et
 * l'application n'a pas les mêmes écrans : ni les lieux, ni les ligues n'y
 * existent. Ouvrir aveuglément le chemin reçu afficherait une page blanche,
 * sans même un message — le routeur ne connaîtrait tout simplement pas
 * l'adresse.
 *
 * Ce module fait donc le tri : ce qui a un écran ici y mène, le reste retombe
 * sur la liste des notifications. Voir la notification qu'on vient de toucher,
 * même sans son détail, vaut mieux qu'un écran vide.
 *
 * Module pur, sans React ni Tauri.
 */

/** Les préfixes que l'application sait ouvrir, tels que `src/App.tsx` les déclare. */
const SUPPORTED_PREFIXES = [
  "/events/",
  "/trades/",
  "/tournaments/",
  "/game-matches/",
  "/games/",
  "/news/",
  "/users/",
];

/** Les écrans sans identifiant, à comparer entiers. */
const SUPPORTED_EXACT = ["/events", "/games", "/trades", "/play", "/collection", "/notifications"];

/**
 * Route de l'application correspondant à un lien de notification, ou `null`
 * quand rien ici ne lui répond.
 *
 * Le résultat est un chemin, pas encore un fragment : le `#` est ajouté au
 * dernier moment, par celui qui navigue.
 */
export function toMobileRoute(link: string | null | undefined): string | null {
  if (!link) return null;

  // Une adresse absolue n'a rien à faire là — le serveur n'en produit pas, et
  // en suivre une ferait sortir de l'application.
  if (!link.startsWith("/") || link.startsWith("//")) return null;

  const path = link.split(/[?#]/)[0];

  if (SUPPORTED_EXACT.includes(path)) return path;
  if (SUPPORTED_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length)) {
    return path;
  }

  return null;
}

/**
 * Où mener au toucher d'une notification. Toujours une route valide : à
 * défaut de mieux, la liste des notifications.
 */
export function notificationDestination(link: string | null | undefined): string {
  return toMobileRoute(link) ?? "/notifications";
}
