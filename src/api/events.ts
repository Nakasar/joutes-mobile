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
}

export function listEvents(
  params: ListEventsParams = {},
): Promise<JoutesEvent[]> {
  return withCache(`events:list:${JSON.stringify(params)}`, async () => {
    const response = await api.get<EventsListResponse>(endpoints.events.list, {
      ...params,
    });
    return response.events;
  });
}
