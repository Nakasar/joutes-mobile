import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Game, GameSummary } from "./types";

export function listGames(): Promise<GameSummary[]> {
  return api.get<GameSummary[]>(endpoints.games.list);
}

export function getGame(idOrSlug: string): Promise<Game> {
  return api.get<Game>(endpoints.games.detail(idOrSlug));
}
