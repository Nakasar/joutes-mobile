import { api } from "./client";
import { endpoints } from "./endpoints";
import type { EventsListResponse, JoutesEvent } from "./types";
import { withCache } from "../lib/response-cache";

export interface ListEventsParams {
  /** Mois 1-12. */
  month?: number;
  year?: number;
  gameId?: string;
  lairId?: string;
  /** Borne de date ISO, indépendante du calendrier mois/année. */
  afterDate?: string;
  beforeDate?: string;
  /**
   * « Autour de moi » : les trois vont ensemble. Sans session, c'est la seule
   * façon d'obtenir des événements ; avec, la proximité remplace les lieux
   * suivis.
   */
  userLat?: number;
  userLon?: number;
  /** Rayon en kilomètres. */
  maxDistance?: number;
}

export function listEvents(
  params: ListEventsParams = {},
): Promise<JoutesEvent[]> {
  // Clé déterministe : tuple à ordre fixe plutôt que `JSON.stringify(params)`,
  // dont l'ordre des propriétés dépend de l'appelant.
  const key = [
    params.month,
    params.year,
    params.gameId,
    params.lairId,
    params.afterDate,
    params.beforeDate,
    params.userLat,
    params.userLon,
    params.maxDistance,
  ].join("|");
  return withCache(`events:list:${key}`, async () => {
    const response = await api.get<EventsListResponse>(endpoints.events.list, {
      ...params,
    });
    return response.events;
  });
}

export function getEvent(eventId: string): Promise<JoutesEvent> {
  return withCache(`events:detail:${eventId}`, () =>
    api.get<JoutesEvent>(endpoints.events.detail(eventId)),
  );
}

/** Bascule le favori de l'utilisateur connecté sur cet évènement. */
export function toggleEventFavorite(eventId: string): Promise<{ favorited: boolean }> {
  return api.post<{ favorited: boolean }>(endpoints.events.favorite(eventId), {});
}

/**
 * Liste d'attente d'un évènement complet. Quand une place se libère, le
 * premier de la file reçoit une notification et la place lui est réservée
 * jusqu'à `viewerWaitlist.offer.expiresAt` : il l'accepte ou la décline.
 */
export function joinEventWaitlist(eventId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>(endpoints.events.waitlist(eventId), {});
}

export function leaveEventWaitlist(eventId: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(endpoints.events.waitlist(eventId));
}

export function acceptEventWaitlistOffer(eventId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>(endpoints.events.waitlistAccept(eventId), {});
}

export function declineEventWaitlistOffer(eventId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>(endpoints.events.waitlistDecline(eventId), {});
}
