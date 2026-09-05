import { isAppBlobImageUrl } from "./blob-image-url";
import { zoneEntries, type DeckCardInfo, type DeckCards } from "./deck-contents";
import type { DeckZone } from "./deck-zones";

/**
 * Copie de `lib/decks/cover.ts` de joutes-app — toute modification doit être
 * reportée dans les deux dépôts, le serveur écrivant `coverImage` avec le
 * même ordre de résolution.
 *
 * D'où vient l'illustration d'un deck : une image déposée par l'auteur, une
 * carte du deck qu'il a désignée, ou — tant qu'il n'a rien désigné — la carte
 * qui donne déjà son identité au deck. `none` est le deck qui n'a ni l'une ni
 * l'autre, et qui s'affiche donc en aplat.
 */
export type DeckCoverSource = "upload" | "card" | "legend" | "none";

export type DeckCoverFields = {
  coverImageUrl?: string;
  coverCardId?: string;
  coverImage?: string;
  legendCardId?: string;
};

export type DeckCover = {
  source: DeckCoverSource;
  image?: string;
  cardId?: string;
};

/**
 * Le catalogue est facultatif : une fiche l'a sous la main et rend
 * l'illustration à jour, une liste lit la valeur dénormalisée `coverImage`.
 */
export function resolveDeckCover(
  deck: DeckCoverFields,
  cardsById?: Map<string, DeckCardInfo>,
): DeckCover {
  if (deck.coverImageUrl) {
    return { source: "upload", image: deck.coverImageUrl };
  }

  if (deck.coverCardId) {
    return {
      source: "card",
      cardId: deck.coverCardId,
      image: cardsById?.get(deck.coverCardId)?.image ?? deck.coverImage,
    };
  }

  if (deck.legendCardId) {
    return {
      source: "legend",
      cardId: deck.legendCardId,
      image: cardsById?.get(deck.legendCardId)?.image ?? deck.coverImage,
    };
  }

  return { source: "none", image: deck.coverImage };
}

export function deckCoverImage(
  deck: DeckCoverFields,
  cardsById?: Map<string, DeckCardInfo>,
): string | undefined {
  return resolveDeckCover(deck, cardsById).image;
}

/** Les cartes parmi lesquelles choisir : celles du deck, dans l'ordre des zones, une fois chacune. */
export function deckCoverCandidates(cards: DeckCards | undefined, zones: DeckZone[]): string[] {
  const seen = new Set<string>();

  for (const zone of zones) {
    for (const entry of zoneEntries(cards, zone.key)) {
      seen.add(entry.cardId);
    }
  }

  return [...seen];
}

/** Une illustration de carte porte son sujet en haut ; une image déposée se cadre au centre. */
export function deckCoverPosition(source: DeckCoverSource): "top" | "center" {
  return source === "upload" ? "center" : "top";
}

export function isDeckCoverImageUrl(value: string): boolean {
  return isAppBlobImageUrl(value);
}
