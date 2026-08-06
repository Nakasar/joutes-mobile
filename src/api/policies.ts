import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CreatePolicyInput, Policy, VoteTally, VoteType } from "./types";
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

/**
 * Publie une politique. Réservé aux comptes portant `policies:update` :
 * contrairement aux erratas, les politiques font autorité.
 */
export function createPolicy(
  gameIdOrSlug: string,
  input: CreatePolicyInput,
): Promise<Policy> {
  return api.post<Policy>(endpoints.games.policies(gameIdOrSlug), input);
}

/**
 * Vote sur une politique. Revoter à l'identique retire le vote ; l'API renvoie
 * le décompte à jour.
 */
export function votePolicy(
  gameIdOrSlug: string,
  policyId: string,
  vote: VoteType,
): Promise<VoteTally> {
  return api
    .post<{ votes: VoteTally }>(endpoints.games.policyVote(gameIdOrSlug, policyId), {
      vote,
    })
    .then((result) => result.votes);
}
