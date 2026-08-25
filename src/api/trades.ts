import { api, ApiError } from "./client";
import { endpoints } from "./endpoints";
import type {
  Trade,
  TradeCard,
  TradeCardDesignation,
  TradeCardResolveResponse,
  TradeCardScope,
  TradeCardSearchResult,
  TradeError,
  TradeOfferUpdateInput,
} from "./types";

export interface TradeInsufficientCopyDetail {
  name: string;
  setCode: string;
  collectorNumber: string;
  requested: number;
  owned: number;
}

/**
 * Résultat normalisé d'une opération d'échange, miroir de `TradeActionResult`
 * côté API : un échec porte toujours un code d'erreur typé et, quand connu,
 * l'état à jour de l'échange (utile pour se resynchroniser sans requête
 * supplémentaire — conflit de révision, stock insuffisant...).
 */
export type TradeActionResult =
  | { ok: true; trade: Trade; applied?: boolean; joined?: boolean }
  | {
      ok: false;
      error: TradeError | "failed";
      trade?: Trade;
      details?: TradeInsufficientCopyDetail[];
    };

interface TradeErrorBody {
  error?: string;
  trade?: Trade;
  details?: TradeInsufficientCopyDetail[];
}

function toActionResult<T extends { trade?: Trade }>(
  promise: Promise<T>,
): Promise<TradeActionResult> {
  return promise
    .then((data) => ({ ok: true as const, trade: data.trade as Trade, ...data }))
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const body = err.body as TradeErrorBody;
        return {
          ok: false as const,
          error: (body.error as TradeError) ?? "failed",
          trade: body.trade,
          details: body.details,
        };
      }
      return { ok: false as const, error: "failed" as const };
    });
}

/** Échanges de l'utilisateur connecté : en cours et historique. */
export function listTrades(): Promise<{ open: Trade[]; past: Trade[] }> {
  return api.get<{ open: Trade[]; past: Trade[] }>(endpoints.trades.list);
}

/** Ouvre un nouvel échange, contrepartie libre. */
export function createTrade(): Promise<Trade> {
  return api.post<{ trade: Trade }>(endpoints.trades.create).then((r) => r.trade);
}

export function getTrade(tradeId: string): Promise<Trade> {
  return api.get<{ trade: Trade }>(endpoints.trades.detail(tradeId)).then((r) => r.trade);
}

export function joinTrade(code: string): Promise<TradeActionResult> {
  return toActionResult(
    api.post<{ trade: Trade }>(endpoints.trades.join, { code }),
  );
}

export function cancelTrade(tradeId: string): Promise<TradeActionResult> {
  return toActionResult(api.delete<{ trade: Trade }>(endpoints.trades.detail(tradeId)));
}

export function setTradeOffer(
  tradeId: string,
  input: TradeOfferUpdateInput,
): Promise<TradeActionResult> {
  return toActionResult(
    api.put<{ trade: Trade }>(endpoints.trades.offer(tradeId), input),
  );
}

export function setTradePartner(
  tradeId: string,
  identifier: string,
): Promise<TradeActionResult> {
  return toActionResult(
    api.post<{ trade: Trade }>(endpoints.trades.partner(tradeId), { identifier }),
  );
}

export function removeTradePartner(tradeId: string): Promise<TradeActionResult> {
  return toActionResult(
    api.delete<{ trade: Trade }>(endpoints.trades.partner(tradeId)),
  );
}

export function validateTrade(
  tradeId: string,
  revision: number,
): Promise<TradeActionResult> {
  return toActionResult(
    api.post<{ trade: Trade; applied: boolean }>(endpoints.trades.validate(tradeId), {
      revision,
    }),
  );
}

export function revokeTradeValidation(tradeId: string): Promise<TradeActionResult> {
  return toActionResult(
    api.delete<{ trade: Trade }>(endpoints.trades.validate(tradeId)),
  );
}

/**
 * Apparie une liste de cartes écrite en texte à des impressions réelles, dans
 * sa propre collection (`collection`) ou dans le catalogue (`catalog`).
 *
 * Sans cache : le résultat dépend de la collection de l'appelant, qui change à
 * chaque échange conclu, et il ne sert qu'une fois — au moment d'appliquer la
 * liste. La réponse suit l'ordre des désignations, `null` marquant celles
 * qu'aucune carte ne satisfait.
 */
export function resolveTradeCards(
  scope: TradeCardScope,
  cards: TradeCardDesignation[],
): Promise<(TradeCard | null)[]> {
  return api
    .post<TradeCardResolveResponse>(endpoints.trades.resolveCards, { scope, cards })
    .then((r) => r.matches ?? []);
}

export function searchTradeCards(params: {
  scope: TradeCardScope;
  q?: string;
  gameId?: string;
  page?: number;
  limit?: number;
}): Promise<TradeCardSearchResult> {
  return api.get<TradeCardSearchResult>(endpoints.trades.cards, params);
}
