import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  DeckCommentsResponse,
  GroupMetaResponse,
  GroupTournamentsResponse,
  PlayGroupDeck,
  PlayGroupDecksAddOutcome,
} from "./types";

/**
 * Le jeu dans un groupe : sa bibliothèque de decks, la timeline des tournois de
 * ses membres, sa méta, et les fils de commentaires d'un deck.
 *
 * **Pas de cache.** Tout ici change sous les doigts des membres (un deck
 * partagé, un commentaire, un résultat déclaré), et un fil servi depuis le
 * cache ferait croire à un commentaire perdu. Les mêmes règles d'accès que les
 * vues web (`?view=decks|tournaments|meta`) : réservé aux membres.
 */

export interface GroupDeckFilters {
  /** Id du jeu. */
  jeu?: string;
  /** Id du membre auteur. */
  membre?: string;
  q?: string;
}

export function listGroupDecks(playGroupId: string, filters: GroupDeckFilters = {}): Promise<PlayGroupDeck[]> {
  return api
    .get<{ decks: PlayGroupDeck[] }>(endpoints.playGroups.decks(playGroupId), { ...filters })
    .then((r) => r.decks ?? []);
}

/** Partage des decks de l'appelant au groupe. Les refusés reviennent avec leur raison. */
export function addGroupDecks(playGroupId: string, deckIds: string[]): Promise<PlayGroupDecksAddOutcome> {
  return api.post<PlayGroupDecksAddOutcome>(endpoints.playGroups.decks(playGroupId), { deckIds });
}

/** Retire un deck de la bibliothèque (le deck lui-même reste). */
export function removeGroupDeck(playGroupId: string, deckId: string): Promise<void> {
  return api.delete<void>(endpoints.playGroups.decks(playGroupId), { deckId });
}

export interface GroupTournamentFilters {
  jeu?: string;
  membre?: string;
  /** `AAAA-MM` : la page qui commence avant ce mois. */
  avant?: string;
}

export function getGroupTournaments(
  playGroupId: string,
  filters: GroupTournamentFilters = {},
): Promise<GroupTournamentsResponse> {
  return api.get<GroupTournamentsResponse>(endpoints.playGroups.tournaments(playGroupId), { ...filters });
}

export interface GroupMetaParams {
  jeu?: string;
  /** Un code d'extension, ou `tout`. Absent : l'extension en cours. */
  ext?: string;
  membre?: string;
  /** `0` éteint la comparaison avec la méta du jeu. */
  comparer?: "0";
}

export function getGroupMeta(playGroupId: string, params: GroupMetaParams = {}): Promise<GroupMetaResponse> {
  return api.get<GroupMetaResponse>(endpoints.playGroups.meta(playGroupId), { ...params });
}

/** L'espace d'un fil : le groupe, ou l'espace personnel de l'auteur du deck. */
export function groupSpace(playGroupId: string): string {
  return `group:${playGroupId}`;
}

/** Le fil d'un deck. `markRead` enregistre la visite ; `lastReadAt` rend la précédente. */
export function getDeckComments(deckId: string, space: string, markRead = false): Promise<DeckCommentsResponse> {
  return api.get<DeckCommentsResponse>(endpoints.decks.comments(deckId), {
    space,
    ...(markRead ? { markRead: "1" } : {}),
  });
}

export interface DeckCommentDraft {
  space: string;
  body: string;
  /** Dix au plus, toutes dans le deck ; une réponse n'en lie aucune. */
  cardIds?: string[];
  parentId?: string;
}

/** Le serveur renvoie le commentaire stocké, pas sa forme de vue : on recharge le fil. */
export async function postDeckComment(deckId: string, draft: DeckCommentDraft): Promise<void> {
  await api.post<{ comment: unknown }>(endpoints.decks.comments(deckId), draft);
}

/** Marque une racine résolue (à la version actuelle du deck) ou la rouvre. */
export function resolveDeckComment(deckId: string, commentId: string, resolved: boolean): Promise<void> {
  return api.patch<void>(endpoints.decks.comments(deckId), { commentId, resolved });
}

export function deleteDeckComment(deckId: string, commentId: string): Promise<void> {
  return api.delete<void>(endpoints.decks.comments(deckId), { commentId });
}
