import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  ExploreResponse,
  PlayGroup,
  PlayGroupAnnouncement,
  PlayGroupContent,
  PlayGroupRsvpAnswer,
  PlayGroupSession,
  PlayGroupShowcase,
} from "./types";
import { cacheDelete, withCache } from "../lib/response-cache";

/** Les groupes du compte connecté. */
export function listPlayGroups(): Promise<PlayGroup[]> {
  return withCache("social:groups", () =>
    api
      .get<{ groups: PlayGroup[] }>(endpoints.playGroups.list)
      .then((r) => r.groups ?? []),
  );
}

/** La fiche d'un groupe — entière pour un membre, allégée pour un visiteur. */
export function getPlayGroup(playGroupId: string): Promise<PlayGroup> {
  return withCache(`social:group:${playGroupId}`, () =>
    api
      .get<{ group: PlayGroup }>(endpoints.playGroups.detail(playGroupId))
      .then((r) => r.group),
  );
}

/** La vitrine publique, mémorisée : elle change au rythme des publications. */
export function getPlayGroupShowcase(playGroupId: string): Promise<PlayGroupShowcase> {
  return withCache(`social:group-showcase:${playGroupId}`, () =>
    api.get<PlayGroupShowcase>(endpoints.playGroups.showcase(playGroupId)),
  );
}

/**
 * Les sessions du groupe.
 *
 * **Aucun cache, ici ni sur rien de ce qui suit.** Une session porte des votes
 * et des réponses de présence : servir depuis IndexedDB une liste vieille de
 * dix minutes ferait croire à un vote enregistré qui ne l'est pas, ou à une
 * place libre qui vient d'être prise. Le prix d'un aller-retour est très
 * inférieur à celui d'une soirée où deux personnes croient s'être inscrites.
 */
export function listPlayGroupSessions(
  playGroupId: string,
  statuses?: readonly string[],
): Promise<PlayGroupSession[]> {
  return api
    .get<{ sessions: PlayGroupSession[] }>(endpoints.playGroups.sessions(playGroupId), {
      ...(statuses && statuses.length > 0 ? { status: [...statuses] } : {}),
    })
    .then((r) => r.sessions ?? []);
}

export interface SessionDraft {
  title: string;
  gameId?: string;
  place?: { kind: "joutes" | "free" | "member"; lairId?: string; label?: string; detail?: string };
  /** Une date ferme… */
  startsAt?: string;
  endsAt?: string;
  /** …ou des créneaux à sonder. L'un des deux, jamais aucun. */
  slots?: { startsAt: string }[];
  pollClosesAt?: string;
}

export function createPlayGroupSession(
  playGroupId: string,
  draft: SessionDraft,
): Promise<PlayGroupSession> {
  return api
    .post<{ session: PlayGroupSession }>(endpoints.playGroups.sessions(playGroupId), draft)
    .then((r) => r.session);
}

/** Bascule la disponibilité du membre sur un créneau du sondage. */
export function votePlayGroupSlot(
  playGroupId: string,
  sessionId: string,
  slotId: string,
): Promise<PlayGroupSession> {
  return api
    .post<{ session: PlayGroupSession }>(
      endpoints.playGroups.sessionVote(playGroupId, sessionId),
      { slotId },
    )
    .then((r) => r.session);
}

/** Tranche le sondage — fondateur et admins seulement. */
export function confirmPlayGroupSlot(
  playGroupId: string,
  sessionId: string,
  slotId: string,
): Promise<PlayGroupSession> {
  return api
    .post<{ session: PlayGroupSession }>(
      endpoints.playGroups.sessionConfirm(playGroupId, sessionId),
      { slotId },
    )
    .then((r) => r.session);
}

/** Répond présent — redonner la même réponse l'annule, comme sur le web. */
export function setPlayGroupRsvp(
  playGroupId: string,
  sessionId: string,
  answer: PlayGroupRsvpAnswer,
): Promise<PlayGroupSession> {
  return api
    .put<{ session: PlayGroupSession }>(
      endpoints.playGroups.sessionRsvp(playGroupId, sessionId),
      { answer },
    )
    .then((r) => r.session);
}

/** Annule la session : elle reste lisible, et explique un trou dans l'agenda. */
export function cancelPlayGroupSession(
  playGroupId: string,
  sessionId: string,
): Promise<PlayGroupSession> {
  return api
    .delete<{ session: PlayGroupSession }>(
      endpoints.playGroups.session(playGroupId, sessionId),
    )
    .then((r) => r.session);
}

/** Les annonces du groupe, toutes portées confondues — réservé aux membres. */
export function listPlayGroupAnnouncements(
  playGroupId: string,
): Promise<PlayGroupAnnouncement[]> {
  return api
    .get<{ announcements: PlayGroupAnnouncement[] }>(
      endpoints.playGroups.announcements(playGroupId),
    )
    .then((r) => r.announcements ?? []);
}

export function publishPlayGroupAnnouncement(
  playGroupId: string,
  draft: { title: string; body?: string; scope: "group" | "public" },
): Promise<PlayGroupAnnouncement> {
  return api
    .post<{ announcement: PlayGroupAnnouncement }>(
      endpoints.playGroups.announcements(playGroupId),
      draft,
    )
    .then(async (r) => {
      // La vitrine reprend les annonces publiques : la mémoriser après avoir
      // publié la montrerait sans celle qu'on vient d'écrire.
      await cacheDelete(`social:group-showcase:${playGroupId}`);
      return r.announcement;
    });
}

export async function deletePlayGroupAnnouncement(
  playGroupId: string,
  announcementId: string,
): Promise<void> {
  await api.delete(endpoints.playGroups.announcement(playGroupId, announcementId));
  await cacheDelete(`social:group-showcase:${playGroupId}`);
}

export function publishPlayGroupContent(
  playGroupId: string,
  draft: {
    kind: "video" | "article" | "replay";
    title: string;
    summary?: string;
    body?: string;
    url?: string;
    thumbnail?: string;
    duration?: string;
    gameId?: string;
  },
): Promise<PlayGroupContent> {
  return api
    .post<{ content: PlayGroupContent }>(endpoints.playGroups.contents(playGroupId), draft)
    .then(async (r) => {
      await cacheDelete(`social:group-showcase:${playGroupId}`);
      return r.content;
    });
}

export async function deletePlayGroupContent(
  playGroupId: string,
  contentId: string,
): Promise<void> {
  await api.delete(endpoints.playGroups.content(playGroupId, contentId));
  await cacheDelete(`social:group-showcase:${playGroupId}`);
}

/**
 * Suivre la vitrine d'un groupe, ou cesser de la suivre.
 *
 * Deux verbes idempotents, comme partout ailleurs : une bascule laisserait un
 * double toucher dans l'état contraire à celui voulu.
 */
export async function setFollowingPlayGroup(
  playGroupId: string,
  following: boolean,
): Promise<{ following: boolean; followerCount: number }> {
  const path = endpoints.playGroups.follow(playGroupId);
  const result = following
    ? await api.put<{ following: boolean; followerCount: number }>(path)
    : await api.delete<{ following: boolean; followerCount: number }>(path);

  await cacheDelete(`social:group-showcase:${playGroupId}`);

  return result;
}

export interface ExploreParams {
  q?: string;
  order?: "vifs" | "proches" | "neufs";
  lat?: number;
  lng?: number;
  count?: number;
}

/**
 * Le rôle d'armes.
 *
 * **Sans cache** : la recherche et l'ordre font partie de la demande, et ce
 * qu'il classe — les directs en cours — se périme en minutes.
 */
export function explorePlayGroups(params: ExploreParams = {}): Promise<ExploreResponse> {
  return api.get<ExploreResponse>(endpoints.playGroups.explore, { ...params });
}
