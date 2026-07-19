import { api } from "./client";
import { endpoints } from "./endpoints";
import type { EventsListResponse, JoutesEvent } from "./types";

export interface ListEventsParams {
  /** Mois 1-12. */
  month?: number;
  year?: number;
  gameId?: string;
  lairId?: string;
}

export async function listEvents(
  params: ListEventsParams = {},
): Promise<JoutesEvent[]> {
  const response = await api.get<EventsListResponse>(endpoints.events.list, {
    ...params,
  });
  return response.events;
}
