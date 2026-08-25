/**
 * Lecture et écriture des listes de cartes en texte — copie partielle de
 * `lib/decks/text.ts` de joutes-app. Toute modification doit être reportée dans
 * les deux dépôts : une liste écrite d'un côté doit se relire de l'autre.
 *
 * Seul le rapprochement des noms est porté pour l'instant ; l'application n'a
 * pas encore d'écran de deck, et `lib/trade/text.ts` — dont vient
 * `trade-text.ts` — s'appuie déjà dessus. Le reste du module suivra avec les
 * decks.
 */

/**
 * Clé de rapprochement d'un nom de carte : sans casse, sans accents, sans
 * espaces superflus.
 *
 * Une liste recopiée à la main ne porte pas toujours ses diacritiques, et
 * « Loup  Argenté » vaut « loup argente » : c'est la même carte, elle doit se
 * fondre avec elle plutôt que d'en créer une seconde entrée.
 */
export function normalizeCardName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
