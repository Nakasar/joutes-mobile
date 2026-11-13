import { api } from "./client";
import { endpoints } from "./endpoints";

/**
 * La méta d'un jeu, telle que le site la calcule (`GET /games/{jeu}/meta`,
 * `lib/meta/app-view.ts` de joutes-app) : l'app ne fait que la mettre en page.
 */

export interface MetaShare {
  decks: number;
  share: number;
}

export interface MetaAppDeck {
  id: string;
  name: string;
  legend?: string;
  legendImage?: string;
  domains: string[];
  placement?: string;
  pilot?: string;
  source: string;
  date: string;
}

export interface MetaLegendShare extends MetaShare {
  key: string;
  name: string;
  cardId?: string;
  image?: string;
  domains: string[];
  topCuts: number;
}

export interface MetaCardStat {
  name: string;
  cardId: string;
  setCode?: string;
  domains: string[];
  decks: number;
  share: number;
  averageCopies: number;
}

export interface MetaTournamentSummary {
  source: string;
  date: string;
  slug: string;
  decks: number;
  winner?: { deckId: string; legend?: string; pilot?: string; image?: string } | null;
  topLegend?: { name: string; decks: number; share: number; image?: string } | null;
  topDomains: { domain: string; share: number }[];
}

export interface MetaMatchTotals {
  matches: number;
  draws: number;
  byes: number;
  rounds: number;
}

export interface MetaLegendWinrate {
  legend: string;
  domains: string[];
  players: number;
  events: number;
  top8: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  rate?: number;
}

export interface MetaDomainWinrate {
  domain: string;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  rate?: number;
}

export interface GameMetaResponse {
  game: { id: string; slug: string; name: string };
  totalDecks: number;
  latestDate: string | null;
  /** Périodes proposées, en jours ; 0 = tout l'historique. */
  periods: number[];
  params: { periodDays: number; legend?: string; domain?: string; source?: string };
  filters: {
    legends: { value: string; label: string; decks: number }[];
    domains: { value: string; decks: number }[];
  };
  overview: {
    decks: number;
    sources: number;
    legends: MetaLegendShare[];
    topLegendsShare: number;
    domains: { domain: string; decks: number; share: number }[];
    topPair?: { domains: string[]; decks: number; share: number } | null;
    cardsPlayed: number;
  };
  cards: MetaCardStat[];
  tournaments: MetaTournamentSummary[];
  decks: MetaAppDeck[];
  winrates: {
    period: { setCode: string; name: string; from: string; to?: string } | null;
    totals: MetaMatchTotals;
    legends: MetaLegendWinrate[];
    domains: MetaDomainWinrate[];
  } | null;
}

export interface MetaTournamentResponse {
  source: string;
  date: string;
  slug: string;
  decks: MetaAppDeck[];
  ranked: number;
  legends: (MetaLegendShare & { topShare: number; best?: string; conversion?: number })[];
  combos: { domains: string[]; decks: number; share: number; topDecks: number; topShare: number }[];
  matches: {
    players: number;
    totals: MetaMatchTotals;
    topCut: { id: number; name: string; place?: number; record?: string; legend?: string; domains?: string[] }[];
    legends: MetaLegendWinrate[];
    url?: string;
  } | null;
}

export interface GameMetaParams {
  period?: number;
  legend?: string;
  domain?: string;
}

export function getGameMeta(gameSlug: string, params: GameMetaParams = {}): Promise<GameMetaResponse> {
  return api.get<GameMetaResponse>(endpoints.games.meta(gameSlug), {
    ...(params.period !== undefined ? { period: String(params.period) } : {}),
    ...(params.legend ? { legend: params.legend } : {}),
    ...(params.domain ? { domain: params.domain } : {}),
  });
}

export function getMetaTournament(gameSlug: string, date: string, slug: string): Promise<MetaTournamentResponse> {
  return api.get<MetaTournamentResponse>(endpoints.games.metaTournament(gameSlug, date, slug));
}
