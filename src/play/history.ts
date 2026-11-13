import type { PlayGame } from "../api/play";
import { BOT_LEVELS, type BotLevel } from "../engine/types";

/**
 * L'historique des parties contre l'IA jouées sur ce téléphone : de quoi dire
 * les paliers battus (Facile, Normal, Difficile), la série de victoires en
 * cours et le meilleur deck. Il reste sur le téléphone, comme les parties.
 */
export type PlayHistoryEntry = {
  /** `<jeu>:<graine>` : une partie n'est comptée qu'une fois. */
  id: string;
  game: PlayGame;
  /** Fin de la partie (ms depuis 1970). */
  at: number;
  /** Début de la partie, quand il est connu. */
  startedAt?: number;
  /** Le niveau de l'IA la plus forte de la table. */
  level: BotLevel;
  outcome: "won" | "lost" | "draw";
  deckName: string;
  /** Code moteur de la légende (le leader à SWU) : la même légende = le même deck. */
  legend: string | null;
  image?: string;
  /** Mes points (ou PV restants à SWU) et ceux du meilleur adversaire. */
  score?: [number, number];
  turns?: number;
};

const HISTORY_STORAGE_KEY = "joutes.play.history";
const HISTORY_LIMIT = 300;

export function readHistory(): PlayHistoryEntry[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (entry): entry is PlayHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PlayHistoryEntry).id === "string" &&
        typeof (entry as PlayHistoryEntry).at === "number" &&
        (BOT_LEVELS as readonly string[]).includes((entry as PlayHistoryEntry).level),
    );
  } catch {
    return [];
  }
}

function writeHistory(entries: PlayHistoryEntry[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(-HISTORY_LIMIT)));
  } catch {
    // Stockage refusé : la partie n'est pas comptée.
  }
}

export function historyId(game: PlayGame, seed: number): string {
  return `${game}:${seed}`;
}

export function isRecorded(game: PlayGame, seed: number): boolean {
  const id = historyId(game, seed);
  return readHistory().some((entry) => entry.id === id);
}

/** Ce que la partie qui vient de finir change : un palier conquis, une série. */
export type RecordOutcome = {
  /** Première victoire à ce niveau, dans ce jeu. */
  firstAtLevel: boolean;
  streak: number;
  deckWins: number;
  deckGames: number;
};

/** Compte la partie (une seule fois) et dit ce qu'elle change. */
export function recordGame(entry: PlayHistoryEntry): RecordOutcome {
  const entries = readHistory();
  const before = entries.filter((other) => other.id !== entry.id);
  const firstAtLevel =
    entry.outcome === "won" &&
    !before.some((other) => other.game === entry.game && other.level === entry.level && other.outcome === "won");
  const all = entries.some((other) => other.id === entry.id) ? entries : [...entries, entry];
  if (all !== entries) writeHistory(all);
  const deck = all.filter((other) => sameDeck(other, entry));
  return {
    firstAtLevel,
    streak: streakOf(all),
    deckWins: deck.filter((other) => other.outcome === "won").length,
    deckGames: deck.length,
  };
}

function sameDeck(a: PlayHistoryEntry, b: PlayHistoryEntry): boolean {
  return a.game === b.game && a.deckName === b.deckName && a.legend === b.legend;
}

/** Les victoires d'affilée, de la plus récente vers le passé ; une égalité arrête la série. */
export function streakOf(entries: PlayHistoryEntry[]): number {
  let streak = 0;
  for (const entry of [...entries].sort((a, b) => b.at - a.at)) {
    if (entry.outcome !== "won") break;
    streak += 1;
  }
  return streak;
}

export type HistoryStats = {
  games: number;
  streak: number;
  /** Victoires par niveau, tous jeux confondus. */
  winsByLevel: Record<BotLevel, number>;
  /** Le deck qui gagne le plus souvent, joué au moins trois fois. */
  bestDeck: { deckName: string; image?: string; wins: number; games: number } | null;
};

export function historyStats(entries: PlayHistoryEntry[] = readHistory()): HistoryStats {
  const winsByLevel = Object.fromEntries(BOT_LEVELS.map((level) => [level, 0])) as Record<BotLevel, number>;
  for (const entry of entries) if (entry.outcome === "won") winsByLevel[entry.level] += 1;

  const decks = new Map<string, { deckName: string; image?: string; wins: number; games: number; at: number }>();
  for (const entry of entries) {
    const key = `${entry.game}|${entry.deckName}|${entry.legend}`;
    const deck = decks.get(key) ?? { deckName: entry.deckName, image: entry.image, wins: 0, games: 0, at: 0 };
    deck.games += 1;
    if (entry.outcome === "won") deck.wins += 1;
    if (entry.at > deck.at) {
      deck.at = entry.at;
      deck.image = entry.image ?? deck.image;
    }
    decks.set(key, deck);
  }
  const best =
    [...decks.values()]
      .filter((deck) => deck.games >= 3)
      .sort((a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins)[0] ?? null;

  return {
    games: entries.length,
    streak: streakOf(entries),
    winsByLevel,
    bestDeck: best && { deckName: best.deckName, image: best.image, wins: best.wins, games: best.games },
  };
}

/** Les niveaux déjà battus dans un jeu. */
export function beatenLevels(game: PlayGame, entries: PlayHistoryEntry[] = readHistory()): Set<BotLevel> {
  return new Set(entries.filter((entry) => entry.game === game && entry.outcome === "won").map((entry) => entry.level));
}

/** Le niveau le plus fort de la table (les IA d'une partie à plusieurs peuvent différer). */
export function strongestLevel(bots: (BotLevel | null)[]): BotLevel {
  let best = 0;
  for (const bot of bots) if (bot) best = Math.max(best, BOT_LEVELS.indexOf(bot));
  return BOT_LEVELS[best];
}

// ---------------------------------------------------------------------------
// La dernière partie lancée de chaque jeu : la « partie rapide » la rejoue.

/** Ce qu'une partie contre l'IA garde pour l'accueil : le deck et l'IA choisis. */
export type SoloMeta = {
  deckName?: string;
  image?: string;
  opponentName?: string;
  opponentImage?: string;
  startedAt?: number;
};

export type LastSetup<R> = { bots: (BotLevel | null)[]; record: R; meta: SoloMeta };

const lastKey = (game: PlayGame) => `joutes.play.last.${game}`;

export function readLastSetup<R>(game: PlayGame): LastSetup<R> | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(lastKey(game)) ?? "null") as LastSetup<R> | null;
    return raw && Array.isArray(raw.bots) && raw.record && typeof raw.meta === "object" ? raw : null;
  } catch {
    return null;
  }
}

export function writeLastSetup<R>(game: PlayGame, setup: LastSetup<R>): void {
  try {
    window.localStorage.setItem(lastKey(game), JSON.stringify(setup));
  } catch {
    // Stockage refusé : pas de partie rapide.
  }
}
