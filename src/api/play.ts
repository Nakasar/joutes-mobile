import { ApiError, api } from "./client";
import type { BotLevel, EngineDeckList, EngineMode } from "../engine/types";
import type { SwuDeckList } from "../engine/swu/types";

/**
 * Le mode Jouer : les routes REST de joutes-app (`/api/games/{jeu}/play/…`),
 * qui exposent telles quelles les actions serveur des pages Jouer du site.
 * Les réponses gardent leur forme (`{ ok, … }` ou `{ ok: false, error }`) : un
 * échec n'est pas une exception ici, c'est un code que la table sait dire.
 */

/** Les jeux que le moteur embarqué sait jouer. */
export const PLAY_GAMES = ["riftbound", "swu"] as const;
export type PlayGame = (typeof PLAY_GAMES)[number];

export function isPlayGame(slug: string | undefined): slug is PlayGame {
  return slug === "riftbound" || slug === "swu";
}

export type TableError =
  | "UNAUTHENTICATED"
  | "OFFLINE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID"
  | "INVALID_DECK"
  | "FULL"
  | "ALREADY_SEATED"
  | "NOT_FULL"
  | "NOT_WAITING"
  | "SERVER";

export type PlayResult<T = object> = ({ ok: true } & T) | { ok: false; error: TableError; details?: string[] };

export type DeckChoice = { kind: "deck"; deckId: string } | { kind: "auto"; legend: string };
export type BotDeckChoice = DeckChoice | { kind: "random" };

export type LobbyDeckSource = "mine" | "shared" | "public" | "meta";

/** Un deck Joutes tel que la page Jouer le propose : traduit et vérifié par le moteur. */
export type LobbyDeck<L = EngineDeckList> = {
  id: string;
  name: string;
  source: LobbyDeckSource;
  /** Code moteur de la légende (le leader à SWU), pour la vignette. */
  legend: string | null;
  legendName?: string;
  domains?: string[];
  author?: string;
  tournament?: string;
  groups?: string[];
  favorites?: number;
  updatedAt?: string;
  /** Absente si le deck ne peut pas être joué ; `problems` dit pourquoi. */
  list: L | null;
  problems: string[];
  completed?: unknown[];
};

export type SwuLobbyDeck = LobbyDeck<SwuDeckList>;

export type GameTableStatus = "waiting" | "playing" | "finished" | "cancelled";

export type GameTableSummary = {
  id: string;
  gameSlug: string;
  mode: EngineMode;
  status: GameTableStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: { winners: number[]; reason: string; turns?: number; points?: number[] };
  seats: { name: string; bot?: BotLevel; deckName: string; legend: string; host: boolean }[];
  players: number;
};

export type TableAccess = { ws: string; game: string; seat: number | null };

export type TableState = {
  table: GameTableSummary;
  seat: number | null;
  isHost: boolean;
  signedIn: boolean;
  access: TableAccess | null;
};

export type RiftboundLobby = {
  signedIn: boolean;
  name: string | null;
  online: boolean;
  decks: LobbyDeck[];
  tables: GameTableSummary[];
  /** Légendes autour desquelles un deck automatique existe. */
  legends: string[];
};

export type SwuLobby = {
  signedIn: boolean;
  name: string | null;
  online: boolean;
  decks: SwuLobbyDeck[];
  tables: GameTableSummary[];
  leaders: string[];
  bases: string[];
};

export type Lobby = { game: "riftbound"; lobby: RiftboundLobby } | { game: "swu"; lobby: SwuLobby };

/** Un échec HTTP porte la même forme qu'un succès : on le rend tel quel. */
async function call<T extends object>(run: () => Promise<PlayResult<T>>): Promise<PlayResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError) {
      const body = error.body as { ok?: boolean; error?: TableError; details?: string[] } | undefined;
      if (body && body.ok === false && typeof body.error === "string") {
        return { ok: false, error: body.error, details: body.details };
      }
      if (error.status === 401) return { ok: false, error: "UNAUTHENTICATED" };
      if (error.status === 404) return { ok: false, error: "NOT_FOUND" };
    }
    return { ok: false, error: "SERVER" };
  }
}

const base = (game: PlayGame) => `/games/${game}/play`;

export function loadLobby(game: "riftbound"): Promise<PlayResult<{ lobby: RiftboundLobby }>>;
export function loadLobby(game: "swu"): Promise<PlayResult<{ lobby: SwuLobby }>>;
export function loadLobby(game: PlayGame): Promise<PlayResult<{ lobby: RiftboundLobby | SwuLobby }>>;
export function loadLobby(game: PlayGame) {
  return call(() => api.get<PlayResult<{ lobby: RiftboundLobby | SwuLobby }>>(`${base(game)}/lobby`));
}

export function searchPlayDecks<D extends LobbyDeck<unknown>>(game: PlayGame, query: string): Promise<D[]> {
  return call(() => api.get<PlayResult<{ decks: D[] }>>(`${base(game)}/decks`, { q: query })).then((result) =>
    result.ok ? result.decks : [],
  );
}

export function resolveDeck<L>(game: PlayGame, reference: string) {
  return call(() => api.post<PlayResult<{ name: string; list: L }>>(`${base(game)}/decks/resolve`, { reference }));
}

export function createTable(game: PlayGame, mode: EngineMode, choice: DeckChoice | null) {
  return call(() => api.post<PlayResult<{ id: string }>>(`${base(game)}/tables`, { mode, choice }));
}

export function readTable(game: PlayGame, id: string) {
  return call(() => api.get<PlayResult<{ state: TableState }>>(`${base(game)}/tables/${encodeURIComponent(id)}`));
}

const tableAction = (game: PlayGame, id: string, action: string, body: object) =>
  call(() => api.post<PlayResult>(`${base(game)}/tables/${encodeURIComponent(id)}/${action}`, body));

export const joinTable = (game: PlayGame, id: string, choice: DeckChoice | null) =>
  tableAction(game, id, "join", { choice });
export const addBot = (game: PlayGame, id: string, level: BotLevel) => tableAction(game, id, "bots", { level });
export const leaveSeat = (game: PlayGame, id: string, seat: number, name: string) =>
  tableAction(game, id, "leave", { seat, name });
export const startTable = (game: PlayGame, id: string) => tableAction(game, id, "start", {});
