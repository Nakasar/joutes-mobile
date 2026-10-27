import type { TFunction } from "i18next";
import type { EventHighlights, HighlightFriend } from "../api/types";

/**
 * Les marques d'un événement mises en phrases : « Léa et Tom y vont »,
 * « Mis en avant par Le Dé Pipé », « Populaire · 14 inscrits et intéressés ».
 *
 * Mêmes règles que le site (`components/events/EventHighlightBadges.tsx`) :
 * la raison la plus forte d'abord — des amis, puis le lieu, puis la
 * popularité.
 */

/** À partir de combien d'inscrits et intéressés le serveur dit « populaire ». */
const POPULAR_MIN_INTEREST = 12;

// `Intl.ListFormat` est dans toutes les vues web visées, pas dans la `lib`
// TypeScript du projet.
const ListFormat = (
  Intl as unknown as {
    ListFormat: new (locale: string, options: { style: string; type: string }) => { format(items: string[]): string };
  }
).ListFormat;

export type HighlightReason = { kind: "friends" | "lairPick" | "popular"; text: string };

export function hasHighlight(highlights: EventHighlights | undefined): boolean {
  return Boolean(highlights && (highlights.popular || highlights.lairPick || highlights.friends.length > 0));
}

function listNames(friends: HighlightFriend[], t: TFunction, locale: string, max: number): string {
  const names = friends.slice(0, max).map((friend) => friend.displayName);
  const rest = friends.length - names.length;
  if (rest > 0) names.push(t("highlights.others", { count: rest }));
  return new ListFormat(locale, { style: "long", type: "conjunction" }).format(names);
}

/** Les inscrits d'abord, puis les intéressés ; `max` pseudos cités par groupe. */
export function friendsSentence(friends: HighlightFriend[], t: TFunction, locale: string, max = 3): string {
  const going = friends.filter((friend) => friend.kind === "registered");
  const interested = friends.filter((friend) => friend.kind === "interested");
  return [
    going.length > 0 ? t("highlights.going", { names: listNames(going, t, locale, max), count: going.length }) : null,
    interested.length > 0
      ? t("highlights.interested", { names: listNames(interested, t, locale, max), count: interested.length })
      : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function highlightReason(
  highlights: EventHighlights,
  t: TFunction,
  locale: string,
  lairName?: string,
): HighlightReason | null {
  if (highlights.friends.length > 0) {
    return { kind: "friends", text: friendsSentence(highlights.friends, t, locale) };
  }
  if (highlights.lairPick) {
    return { kind: "lairPick", text: lairName ? t("highlights.byLair", { lair: lairName }) : t("highlights.lairPick") };
  }
  if (highlights.popular) {
    return {
      kind: "popular",
      text:
        highlights.interest >= POPULAR_MIN_INTEREST
          ? t("highlights.popularCount", { count: highlights.interest })
          : t("highlights.popularFilling"),
    };
  }
  return null;
}
