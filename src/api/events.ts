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
  // Clé déterministe : tuple à ordre fixe plutôt que `JSON.stringify(params)`,
  // dont l'ordre des propriétés dépend de l'appelant.
  const key = [params.month, params.year, params.gameId, params.lairId].join(
    "|",
  );
  return withCache(`events:list:${key}`, async () => {
    const response = await api.get<EventsListResponse>(endpoints.events.list, {
      ...params,
    });
    return response.events;
  });
}
