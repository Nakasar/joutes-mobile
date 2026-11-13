import type { DeckList, DeckListCard } from "../api/types";
import type { DeckCards } from "./deck-contents";
import type { DeckZoneKey } from "./deck-zones";

/**
 * Import d'un deck Riftbound depuis Piltover Archive : un lien
 * (`https://piltoverarchive.com/decks/view/…`) ou un code de deck.
 *
 * Le site lit le deck (route du vérificateur de deck) et apparie chaque carte
 * à son catalogue ; il ne reste ici qu'à ranger ces cartes dans les zones du
 * deck Joutes. Ce que le site n'a pas reconnu est rendu à part, pour être dit.
 */

const PILTOVER_LINK = /^https?:\/\/(www\.)?piltoverarchive\.com\/decks\/view\/[\w-]+/i;

/** Un lien Piltover Archive, ou un code de deck (une suite sans espace). */
export function isPiltoverImport(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  return PILTOVER_LINK.test(value) || (!/\s/.test(value) && value.length >= 8);
}

/** Le lien sans paramètres ni fragment : c'est la forme qu'attend le site. */
export function normalizePiltoverInput(input: string): string {
  const value = input.trim();
  const match = value.match(PILTOVER_LINK);
  return match ? match[0] : value;
}

const ZONES: [keyof DeckList, DeckZoneKey][] = [
  ["legends", "legend"],
  ["champions", "champions"],
  ["maindeck", "maindeck"],
  ["runes", "runes"],
  ["battlefields", "battlefields"],
  ["sideboard", "sideboard"],
];

export function deckListToCards(list: DeckList): { cards: DeckCards; count: number; unmatched: string[] } {
  const cards: DeckCards = {};
  const unmatched: string[] = [];
  let count = 0;
  for (const [from, zone] of ZONES) {
    for (const entry of (list[from] ?? []) as DeckListCard[]) {
      if (!entry.cardId || entry.recognized === false) {
        if (!unmatched.includes(entry.name)) unmatched.push(entry.name);
        continue;
      }
      const entries = cards[zone] ?? [];
      const existing = entries.find((e) => e.cardId === entry.cardId);
      if (existing) existing.quantity += entry.quantity;
      else entries.push({ cardId: entry.cardId, quantity: entry.quantity });
      cards[zone] = entries;
      count += entry.quantity;
    }
  }
  return { cards, count, unmatched };
}
