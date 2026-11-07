import { parseSearchSyntax, removeSearchWord, type SearchField } from "./search-syntax";

/**
 * Pose (ou retire, avec une valeur vide) le filtre `field:value` dans une
 * saisie, en remplaçant ceux qui portaient déjà sur ce champ. C'est ainsi que
 * les listes « Tous les sets » / « Tous les types » écrivent dans la même barre
 * que la saisie : une seule recherche, lisible et modifiable au clavier.
 */
export function withFieldToken(
  input: string,
  fields: SearchField[],
  field: string,
  value: string,
): string {
  let next = input;
  for (const token of parseSearchSyntax(input, fields).tokens) {
    if (token.field === field) next = removeSearchWord(next, token.raw);
  }
  next = next.trim();
  if (!value) return next;
  const written = /\s/.test(value) ? `${field}:"${value}"` : `${field}:${value}`;
  return next ? `${written} ${next}` : written;
}
