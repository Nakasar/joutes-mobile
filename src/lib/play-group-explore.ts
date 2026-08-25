/**
 * L'exploration des groupes de jeu — portage partiel de
 * `lib/play-groups/explore.ts` de joutes-app, pur et testé là-bas. Toute
 * modification doit être reportée dans les deux dépôts.
 *
 * **Le tri et le classement restent au serveur** : `readActivityRank`,
 * `sortExploreGroups` et `distanceKm` ne sont pas portés, `GET
 * /play-groups/explore` rendant déjà la liste ordonnée. Ce qui est porté est ce
 * dont l'écran a besoin pour lui-même — les ordres proposés, la fraîcheur d'un
 * direct, les initiales de l'écu, et une recherche locale sur ce qui est déjà
 * chargé.
 */

/** Les trois ordres de la page. « vifs » est celui par défaut. */
export const EXPLORE_ORDERS = ["vifs", "proches", "neufs"] as const;

export type ExploreOrder = (typeof EXPLORE_ORDERS)[number];

export function readExploreOrder(value: string | undefined | null): ExploreOrder {
  return EXPLORE_ORDERS.includes(value as ExploreOrder) ? (value as ExploreOrder) : "vifs";
}

/**
 * L'âge au-delà duquel un direct déclaré ne compte plus.
 *
 * Rien ne retire un direct automatiquement : un membre le déclare, un
 * responsable l'enlève. Vingt-quatre heures laissent passer un marathon et
 * écartent l'oubli.
 */
export const LIVE_MAX_AGE_HOURS = 24;

/** Un direct déclaré diffuse-t-il encore, ou a-t-il été oublié ? */
export function isFreshLive(startedAt: string | null | undefined, now: number): boolean {
  const time = readTime(startedAt);
  if (time === null) {
    return false;
  }

  return now - time <= LIVE_MAX_AGE_HOURS * 60 * 60 * 1000;
}

function readTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * Le texte réduit à sa forme cherchable.
 *
 * Sans accents et sans casse : « mediatheque » doit trouver la Médiathèque, et
 * personne ne tape « Dé » avec son accent dans un champ de recherche.
 */
export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Ce que la recherche connaît d'un groupe. */
export type ExploreSearchable = {
  name: string;
  tagline?: string | null;
  rhythmLabel?: string | null;
  place?: { label?: string } | null;
  gameNames?: string[];
};

/** Le texte d'un groupe où la recherche va chercher. */
export function readSearchHaystack(group: ExploreSearchable): string {
  return foldSearchText(
    [
      group.name,
      group.tagline ?? "",
      group.rhythmLabel ?? "",
      group.place?.label ?? "",
      (group.gameNames ?? []).join(" "),
    ].join(" "),
  );
}

export function matchesExploreQuery(group: ExploreSearchable, foldedQuery: string): boolean {
  return foldedQuery === "" || readSearchHaystack(group).includes(foldedQuery);
}

/** Les initiales portées par l'écu — deux lettres au plus. */
export function readInitials(name: string): string {
  const words = name
    .split(/[\s'’-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !SMALL_WORDS.has(foldSearchText(word)));

  const letters = (words.length > 0 ? words : [name])
    .map((word) => word[0])
    .filter((letter) => /\p{L}/u.test(letter));

  return letters.slice(0, 2).join("").toUpperCase() || "?";
}

/** « Les Corbeaux de Thionville » doit donner CT, pas LC. */
const SMALL_WORDS = new Set([
  "le",
  "la",
  "les",
  "l",
  "de",
  "des",
  "du",
  "d",
  "the",
  "of",
  "et",
  "a",
  "au",
  "aux",
]);
