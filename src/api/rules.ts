import { api } from "./client";
import { endpoints } from "./endpoints";
import type { RuleDocument, RuleEntry, RuleLang } from "./types";

/** Liste les entrées d'un document de règles (CR / TR) dans une langue. */
export function getRules(
  gameIdOrSlug: string,
  params: { document: RuleDocument; lang: RuleLang },
): Promise<RuleEntry[]> {
  return api.get<RuleEntry[]>(endpoints.games.rules(gameIdOrSlug), {
    document: params.document,
    lang: params.lang,
  });
}

/** Recherche dans les règles (renvoie les entrées correspondantes + leur contexte). */
export function searchRules(
  gameIdOrSlug: string,
  params: { document?: RuleDocument; lang: RuleLang; query: string; limit?: number },
): Promise<RuleEntry[]> {
  return api.get<RuleEntry[]>(endpoints.games.rules(gameIdOrSlug), {
    document: params.document,
    lang: params.lang,
    searchQuery: params.query,
    limit: params.limit,
  });
}
