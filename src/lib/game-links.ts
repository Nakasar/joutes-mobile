import { externalUrl } from "./lair-urls";

/**
 * Les liens d'un jeu : le site de l'éditeur et ses réseaux.
 *
 * Copie de la table de `lib/constants/game-links.ts` de joutes-app — même
 * ordre, mêmes clés ; toute modification doit être reportée dans les deux
 * dépôts. Les libellés sont des noms propres et ne se traduisent pas.
 *
 * Les clés inconnues sont écartées, et les adresses qui ne sont pas en
 * http(s) aussi : elles finissent dans un `href`.
 */
export const GAME_LINK_KEYS = [
  "website",
  "youtube",
  "twitch",
  "x",
  "instagram",
  "tiktok",
  "bluesky",
  "facebook",
  "discord",
  "reddit",
] as const;

export type GameLinkKey = (typeof GAME_LINK_KEYS)[number];

export const GAME_LINK_LABELS: Record<GameLinkKey, string> = {
  website: "Site officiel",
  youtube: "YouTube",
  twitch: "Twitch",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  bluesky: "Bluesky",
  facebook: "Facebook",
  discord: "Discord",
  reddit: "Reddit",
};

export function readGameLinks(
  links: Record<string, string | undefined> | undefined,
): { key: GameLinkKey; label: string; url: string }[] {
  if (!links) return [];

  return GAME_LINK_KEYS.flatMap((key) => {
    const url = externalUrl(links[key]);
    return url ? [{ key, label: GAME_LINK_LABELS[key], url }] : [];
  });
}

/** Le nom propre d'une plateforme de publication (`lib/social/platforms.ts`). */
export const SOCIAL_PLATFORM_LABELS = {
  bluesky: "Bluesky",
  youtube: "YouTube",
  x: "X",
  instagram: "Instagram",
} as const;

/** « 12:34 » ou « 1:02:03 » — la durée d'une vidéo, comme sur le site. */
export function formatSocialDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || seconds <= 0) return undefined;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** « il y a 3 h », dans la langue de l'application. */
export function formatRelative(iso: string, locale: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}
