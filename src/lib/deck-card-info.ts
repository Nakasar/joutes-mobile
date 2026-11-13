import type { Card } from "../api/types";
import type { DeckCardInfo } from "./deck-contents";

/**
 * Une carte de la recherche, ramenée à ce que le deck sait lire — copie de
 * `lib/decks/card-info.ts` de joutes-app.
 *
 * La recherche rend la fiche brute du catalogue : le coût s'y appelle `energy`
 * à Riftbound, `mana` ailleurs. La route des cartes de deck, elle, le rend déjà
 * sous `cost` ; les deux doivent donner la même courbe.
 */
const CARD_COST_KEYS = ["cost", "energy", "mana", "manaValue", "manaCost"] as const;

function cardCost(card: Card): number | undefined {
  for (const key of CARD_COST_KEYS) {
    const value = card[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function cardDomains(card: Card): string[] | undefined {
  const domain = card.domain;
  if (Array.isArray(domain)) return domain.filter((value): value is string => typeof value === "string");
  if (typeof domain === "string" && domain) return [domain];
  return undefined;
}

export function toDeckCardInfo(card: Card): DeckCardInfo {
  return {
    id: String(card.id ?? ""),
    name: String(card.name ?? ""),
    image: typeof card.image === "string" ? card.image.split("?")[0] : undefined,
    type: card.type,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    cost: cardCost(card),
    domain: cardDomains(card),
    orientation: card.orientation,
    types: Array.isArray(card.types)
      ? card.types.filter((type): type is string => typeof type === "string")
      : undefined,
    superType: typeof card.superType === "string" ? card.superType : undefined,
  };
}
