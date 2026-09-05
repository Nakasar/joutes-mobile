/**
 * Copie de `lib/content/feed-mix.ts` de joutes-app — toute modification doit
 * être reportée dans les deux dépôts : le fil de l'accueil doit choisir ses
 * entrées comme le site choisit les siennes.
 *
 * Choisir les quelques entrées qu'un fil montre, sans qu'une source mange
 * tout. La règle est en deux temps : **le plafond d'abord** — on parcourt les
 * entrées dans l'ordre et on saute celles dont le genre a fait le plein ;
 * **le remplissage ensuite** — s'il reste des places qu'aucune autre source
 * ne peut prendre, on y remet les sautées, toujours dans l'ordre.
 */

export type FeedMixOptions<K extends string> = {
  /** Combien d'entrées le fil montre en tout. */
  max: number;
  /** Le plafond de chaque genre, quand il en a un. */
  caps?: Partial<Record<K, number>>;
};

/** Les entrées retenues, dans l'ordre reçu : ce module ne trie pas, il choisit. */
export function selectFeedEntries<T extends { type: string }>(
  entries: T[],
  { max, caps }: FeedMixOptions<T["type"]>,
): T[] {
  if (max <= 0) {
    return [];
  }

  const retained: T[] = [];
  const deferred: T[] = [];
  const counts = new Map<T["type"], number>();

  for (const entry of entries) {
    if (retained.length >= max) {
      break;
    }

    const cap = caps?.[entry.type as T["type"]];
    const count = counts.get(entry.type) ?? 0;

    if (cap !== undefined && count >= cap) {
      deferred.push(entry);
      continue;
    }

    counts.set(entry.type, count + 1);
    retained.push(entry);
  }

  for (const entry of deferred) {
    if (retained.length >= max) {
      break;
    }

    retained.push(entry);
  }

  const rank = new Map(entries.map((entry, index) => [entry, index]));

  return retained.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}
