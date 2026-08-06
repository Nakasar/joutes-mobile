import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CreateErrataInput, Errata, VoteTally, VoteType } from "./types";

/**
 * Propose un errata / une clarification / un ruling sur une ou plusieurs cartes
 * du jeu. Ouvert à tout compte connecté : le contenu est communautaire, arbitré
 * ensuite par les votes.
 */
export function createErrata(
  gameIdOrSlug: string,
  input: CreateErrataInput,
): Promise<Errata> {
  return api.post<Errata>(endpoints.games.erratas(gameIdOrSlug), input);
}

/**
 * Vote sur la pertinence d'un errata. Revoter à l'identique retire le vote ;
 * l'API renvoie le décompte à jour.
 */
export function voteErrata(
  gameIdOrSlug: string,
  errataId: string,
  vote: VoteType,
): Promise<VoteTally> {
  return api
    .post<{ votes: VoteTally }>(endpoints.games.errataVote(gameIdOrSlug, errataId), {
      vote,
    })
    .then((result) => result.votes);
}
