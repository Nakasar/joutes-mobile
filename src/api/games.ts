import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Game, GameSummary } from "./types";
import { withCache } from "../lib/response-cache";

export function listGames(): Promise<GameSummary[]> {
  return withCache("games:list", () =>
    api.get<GameSummary[]>(endpoints.games.list),
  );
}

export function getGame(idOrSlug: string): Promise<Game> {
  return withCache(`games:detail:${idOrSlug}`, () =>
    api.get<Game>(endpoints.games.detail(idOrSlug)),
  );
}
