import { api } from "./client";
import { endpoints } from "./endpoints";
import type { RuleDocument, RuleEntry, RuleLang } from "./types";
import { offlineRules, offlineSearchRules } from "../lib/offline-adapters";
import { offlineFirst } from "../lib/offline-first";

/** Liste les entrées d'un document de règles (CR / TR) dans une langue. */
export function getRules(
  gameIdOrSlug: string,
  params: { document: RuleDocument; lang: RuleLang },
): Promise<RuleEntry[]> {
  return offlineFirst(
    gameIdOrSlug,
    () =>
      api.get<RuleEntry[]>(endpoints.games.rules(gameIdOrSlug), {
        document: params.document,
        lang: params.lang,
      }),
    (exp) => offlineRules(exp, params.document, params.lang),
  );
}

/** Recherche dans les règles (renvoie les entrées correspondantes + leur contexte). */
export function searchRules(
  gameIdOrSlug: string,
  params: { document?: RuleDocument; lang: RuleLang; query: string; limit?: number },
): Promise<RuleEntry[]> {
  return offlineFirst(
    gameIdOrSlug,
    () =>
      api.get<RuleEntry[]>(endpoints.games.rules(gameIdOrSlug), {
        document: params.document,
        lang: params.lang,
        searchQuery: params.query,
        limit: params.limit,
      }),
    (exp) =>
      // La recherche hors ligne cible le document courant (CR par défaut).
      offlineSearchRules(exp, params.document ?? "CR", params.lang, params.query),
  );
}
