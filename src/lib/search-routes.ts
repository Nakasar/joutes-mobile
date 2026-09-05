import type { SearchResult } from "../api/types";

/**
 * Où un résultat de recherche mène dans l'application.
 *
 * L'API rend le chemin **du site** (`href`), qui n'est pas le nôtre : nos
 * routes se lisent sur `kind` et `id`, avec le jeu quand il en faut un. Un
 * résultat qu'on ne sait pas ouvrir rend `null`, et l'écran le montre sans
 * lien plutôt que d'envoyer vers un écran vide.
 */
export function routeFor(result: SearchResult): string | null {
  switch (result.kind) {
    case "game":
      return `/games/${result.gameSlug ?? result.id}`;
    case "card":
      return result.gameSlug ? `/games/${result.gameSlug}/cards/${result.id}` : null;
    case "lair":
      return `/lairs/${result.id}`;
    case "event":
      return `/events/${result.id}`;
    case "policy":
      return result.gameSlug ? `/games/${result.gameSlug}/policies/${result.id}` : null;
    case "rule": {
      if (!result.gameSlug) return null;
      const params = new URLSearchParams();
      if (result.doc) params.set("doc", result.doc);
      params.set("rule", result.id);
      return `/games/${result.gameSlug}/rules?${params.toString()}`;
    }
    default:
      return null;
  }
}

const RECENT_KEY = "joutes.search.recent";
export const RECENT_MAX = 8;

/** Les dernières questions posées, la plus récente en tête. */
export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string, current: string[] = readRecentSearches()): string[] {
  const q = query.trim();
  if (q.length < 2) return current;
  const next = [q, ...current.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Un stockage indisponible ne doit pas empêcher d'ouvrir le résultat.
  }
  return next;
}

export function forgetRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Idem.
  }
}
