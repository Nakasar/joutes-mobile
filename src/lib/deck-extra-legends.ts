import type { DeckCards } from "./deck-contents";
import type { DeckZone } from "./deck-zones";

/**
 * Neeko, Blending In (Riftbound, RAD-167) — copie de `lib/decks/extra-legends.ts`
 * de joutes-app : « If Neeko is in your deck, choose 3 different legends in
 * addition to your starting legend. »
 *
 * Le deck range alors quatre légendes dans sa zone « Légende ». On reconnaît la
 * carte à son numéro, variantes d'illustration comprises (`RAD167a`).
 */
const EXTRA_LEGENDS_CARD = /^RAD-?0*167[a-z*]*$/i;
export const EXTRA_LEGENDS = 3;

export function isExtraLegendsCard(cardId: string | undefined): boolean {
  return cardId !== undefined && EXTRA_LEGENDS_CARD.test(cardId.trim());
}

/** Le deck contient-il Neeko, dans son deck principal ou comme champion choisi ? */
export function wantsExtraLegends(cards: DeckCards | undefined): boolean {
  return [...(cards?.champions ?? []), ...(cards?.maindeck ?? [])].some(
    (entry) => entry.quantity > 0 && isExtraLegendsCard(entry.cardId),
  );
}

/** Les mêmes zones, avec trois légendes de plus dans la zone « Légende ». */
export function withExtraLegends(zones: DeckZone[]): DeckZone[] {
  return zones.map((zone) =>
    zone.key !== "legend" || zone.max === undefined
      ? zone
      : {
          ...zone,
          min: (zone.min ?? 0) + EXTRA_LEGENDS,
          max: zone.max + EXTRA_LEGENDS,
          extraLegends: EXTRA_LEGENDS,
        },
  );
}

/** Les zones du jeu, ajustées au contenu du deck : avec Neeko, quatre légendes. */
export function zonesForDeck(zones: DeckZone[], cards: DeckCards | undefined): DeckZone[] {
  return wantsExtraLegends(cards) ? withExtraLegends(zones) : zones;
}
