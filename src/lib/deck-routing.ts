import { zoneCount, type DeckCardInfo, type DeckCards } from "./deck-contents";
import { defaultDeckZone, type DeckZone, type DeckZoneKey } from "./deck-zones";

/**
 * Zone d'ajout « automatique » de l'éditeur — copie de `lib/decks/routing.ts`
 * de joutes-app, couverte là-bas par des tests. Toute modification doit être
 * reportée dans les deux dépôts.
 *
 * Chaque carte va là où son type la range, sans que l'auteur ait à changer de
 * zone entre une légende et une rune.
 */
export const AUTO_ZONE = "auto" as const;
export type DeckTargetZone = DeckZoneKey | typeof AUTO_ZONE;

/**
 * Types qui désignent une zone à eux seuls. Seul Riftbound les déclare
 * aujourd'hui ; un jeu qui ne les expose pas range tout dans sa zone principale.
 */
const ZONE_BY_TYPE: Partial<Record<DeckZoneKey, string[]>> = {
  legend: ["legend", "légende"],
  runes: ["rune"],
  battlefields: ["battlefield", "champ de bataille"],
};

function cardTypes(card: DeckCardInfo): string[] {
  return [...(card.types ?? []), ...(card.type ? [card.type] : [])].map((type) => type.toLowerCase());
}

/** Une unité championne : la seule carte qui puisse être le champion choisi. */
export function isChampionCard(card: DeckCardInfo): boolean {
  return card.superType?.toLowerCase() === "champion";
}

/**
 * La zone où ranger une carte ajoutée sans zone choisie.
 *
 * Le champion choisi n'est pas un type mais une place : la première unité
 * championne ajoutée la prend, les suivantes vont au deck principal.
 */
export function routeCardToZone(card: DeckCardInfo, zones: DeckZone[], cards: DeckCards): DeckZoneKey {
  const types = cardTypes(card);
  const has = (key: DeckZoneKey) => zones.some((zone) => zone.key === key);

  for (const [key, names] of Object.entries(ZONE_BY_TYPE) as [DeckZoneKey, string[]][]) {
    if (has(key) && types.some((type) => names.includes(type))) {
      return key;
    }
  }

  const champions = zones.find((zone) => zone.key === "champions");
  if (champions && isChampionCard(card)) {
    const capacity = champions.max ?? 1;
    const alreadyThere = (cards.champions ?? []).some((entry) => entry.cardId === card.id);
    if (!alreadyThere && zoneCount(cards, "champions") < capacity) {
      return "champions";
    }
  }

  return defaultDeckZone(zones);
}

/**
 * La zone où retirer un exemplaire d'une carte quand aucune zone n'est
 * choisie : celle où le rangement l'aurait mise si elle y est, sinon la
 * première qui la porte.
 */
export function zoneHoldingCard(
  card: DeckCardInfo,
  zones: DeckZone[],
  cards: DeckCards,
): DeckZoneKey | undefined {
  const holding = zones.filter((zone) => (cards[zone.key] ?? []).some((entry) => entry.cardId === card.id));
  if (holding.length === 0) return undefined;

  const routed = routeCardToZone(card, zones, cards);
  return holding.find((zone) => zone.key === routed)?.key ?? holding[0].key;
}
