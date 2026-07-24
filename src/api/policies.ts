import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Policy } from "./types";
import { offlineGetPolicy, offlineSearchPolicies } from "../lib/offline-adapters";
import { offlineFirst } from "../lib/offline-first";

export interface ListPoliciesParams {
  searchQuery?: string;
  page?: number;
  limit?: number;
}

/**
 * Liste/recherche les politiques (règles d'organisation, clarifications) d'un
 * jeu. La pagination de l'API repose sur les en-têtes de réponse plutôt que le
 * corps ; côté client on se contente de savoir s'il reste une page à charger
 * (`results.length === limit`), comme pour les cartes.
 */
export function listPolicies(
  gameIdOrSlug: string,
  params: ListPoliciesParams = {},
): Promise<Policy[]> {
  return offlineFirst(
    gameIdOrSlug,
    () =>
      api.get<Policy[]>(endpoints.games.policies(gameIdOrSlug), {
        ...params,
      }),
    (exp) => offlineSearchPolicies(exp, params),
  );
}

export function getPolicy(
  gameIdOrSlug: string,
  policyId: string,
): Promise<Policy> {
  return offlineFirst(
    gameIdOrSlug,
    () => api.get<Policy>(endpoints.games.policy(gameIdOrSlug, policyId)),
    (exp) => offlineGetPolicy(exp, policyId),
  );
}
