import { api } from "./client";
import { endpoints } from "./endpoints";
import type { CardPrinting, MarketPrice } from "./types";

/**
 * Les boosters ouverts, comme sur le site (`/collection/{jeu}/boosters`) :
 * un booster dit son extension, sa langue et son type, et liste ce qu'il
 * contenait. Versé à la collection, il y ajoute ses cartes d'un coup.
 */

export interface BoosterValue {
  amount: number;
  currency: string;
  cardCount: number;
  pricedCards: number;
  computedAt: string;
}

export interface BoosterCard {
  /** Identifiant de l'exemplaire dans le booster. */
  id: string;
  cardId?: string;
  name: string;
  subtitle?: string;
  setCode: string;
  collectorNumber: string;
  lang?: string;
  foil?: boolean;
  printingId?: string;
  printingName?: string;
  image: string;
  type?: string;
  rarity?: string;
  marketPrice?: MarketPrice;
  newInCollection?: boolean;
  [key: string]: unknown;
}

export interface Booster {
  id: string;
  gameId: string;
  setCode: string;
  lang: string;
  type: string;
  note?: string;
  cards: BoosterCard[];
  estimatedValue?: BoosterValue;
  addedToCollection?: boolean;
  createdAt: string;
}

export interface BoostersPage {
  boosters: Booster[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Une carte de l'extension, telle que le scanner la reconnaît. */
export interface ScannerSetCard {
  id: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  lang?: string;
  printings?: CardPrinting[];
  type?: string;
  rarity?: string;
  /** Carte toujours imprimée en foil. */
  foil?: boolean;
}

/** Ce qu'il faut pour ajouter une carte du catalogue à un booster. */
export interface BoosterCardInput {
  cardId?: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  lang?: string;
  foil?: boolean;
}

export function listBoosters(
  gameSlug: string,
  params: { page?: number; sort?: "newest" | "oldest" } = {},
): Promise<BoostersPage> {
  return api.get<BoostersPage>(endpoints.collection.boosters, {
    gameSlug,
    page: params.page ?? 1,
    limit: 30,
    sort: params.sort ?? "newest",
  });
}

export function getBooster(boosterId: string): Promise<Booster> {
  return api.get<{ booster: Booster }>(endpoints.collection.booster(boosterId)).then((r) => r.booster);
}

export function createBooster(input: {
  gameSlug: string;
  setCode: string;
  lang: string;
  type: string;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>(endpoints.collection.boosters, input);
}

export function updateBooster(boosterId: string, patch: { type?: string; note?: string | null }): Promise<unknown> {
  return api.patch(endpoints.collection.booster(boosterId), patch);
}

export function deleteBooster(boosterId: string): Promise<unknown> {
  return api.delete(endpoints.collection.booster(boosterId));
}

export function addBoosterCard(
  boosterId: string,
  card: BoosterCardInput,
): Promise<{ success: boolean; entryId?: string; value?: BoosterValue | null }> {
  return api.post(endpoints.collection.boosterCards(boosterId), card);
}

export function setBoosterCardFoil(boosterId: string, entryId: string, foil: boolean): Promise<unknown> {
  return api.patch(endpoints.collection.boosterCards(boosterId), { entryId, foil });
}

export function removeBoosterCard(boosterId: string, entryId: string): Promise<unknown> {
  return api.delete(endpoints.collection.boosterCards(boosterId), { entryId });
}

export function addBoosterToCollection(boosterId: string): Promise<unknown> {
  return api.post(endpoints.collection.boosterCollection(boosterId), {});
}

export function removeBoosterFromCollection(boosterId: string): Promise<unknown> {
  return api.delete(endpoints.collection.boosterCollection(boosterId));
}

export function recomputeBoosterValue(boosterId: string): Promise<{ value: BoosterValue }> {
  return api.post<{ value: BoosterValue }>(endpoints.collection.boosterValue(boosterId), {});
}

export function getScannerSetCards(gameSlug: string, setCode: string, lang?: string): Promise<ScannerSetCard[]> {
  return api
    .get<{ cards: ScannerSetCard[] }>(endpoints.games.scannerSetCards(gameSlug), {
      setCode,
      ...(lang ? { lang } : {}),
    })
    .then((r) => r.cards ?? []);
}

/** Identification d'une photo par l'IA : la carte trouvée et ce qui a été lu. */
export function aiMatchCard(
  gameSlug: string,
  image: string,
): Promise<{
  match?: { id: string; name: string } | null;
  identification?: { collectorNumber?: string | null } | null;
}> {
  return api.post(endpoints.games.scannerAiMatch(gameSlug), { image });
}

/** Types de booster livrés avec la plateforme, comme `lib/constants/booster-types.ts`. */
const DEFAULT_BOOSTER_TYPES: Record<string, string[]> = {
  riftbound: ["pre-rift", "booster"],
  swu: ["booster", "carbonite", "pre-release"],
  mtg: ["play-booster", "set-booster", "collector", "pre-release"],
  altered: ["booster", "collector"],
  fab: ["booster", "pre-release"],
};

/** Types connus de l'app, traduits ; tout autre type s'affiche par son libellé ou sa clé. */
export const KNOWN_BOOSTER_TYPES = [
  "booster",
  "pre-rift",
  "carbonite",
  "pre-release",
  "play-booster",
  "set-booster",
  "collector",
  "other",
];

/**
 * Les types proposés pour un jeu, « other » en dernier : ceux réglés dans
 * l'administration (`game.boosterTypes`), sinon la liste livrée.
 */
export function boosterTypesFor(game: {
  slug?: string;
  boosterTypes?: { key: string; label?: string }[];
}): { key: string; label?: string }[] {
  const base = game.boosterTypes
    ? game.boosterTypes.filter((type) => type.key !== "other" && type.key !== "custom")
    : (DEFAULT_BOOSTER_TYPES[game.slug ?? ""] ?? []).map((key) => ({ key }));
  return [...base, { key: "other" }];
}

/** Les boosters d'avant les types portent `custom` : c'est un « other ». */
export function normalizeBoosterType(type?: string): string {
  const trimmed = type?.trim();
  return !trimmed || trimmed === "custom" ? "other" : trimmed;
}
