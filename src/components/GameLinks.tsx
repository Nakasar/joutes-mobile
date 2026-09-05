import type { GameLinkKey } from "../lib/game-links";
import { readGameLinks } from "../lib/game-links";
import {
  BlueskyIcon,
  DiscordIcon,
  FacebookIcon,
  GlobeIcon,
  InstagramIcon,
  RedditIcon,
  TiktokIcon,
  TwitchIcon,
  XIcon,
  YoutubeIcon,
} from "./icons";

const ICONS: Record<GameLinkKey, typeof GlobeIcon> = {
  website: GlobeIcon,
  youtube: YoutubeIcon,
  twitch: TwitchIcon,
  x: XIcon,
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  bluesky: BlueskyIcon,
  facebook: FacebookIcon,
  discord: DiscordIcon,
  reddit: RedditIcon,
};

/** Le site de l'éditeur et ses réseaux, en rangée de pastilles sous le hero. */
export function GameLinks({ links }: { links: Record<string, string | undefined> | undefined }) {
  const entries = readGameLinks(links);
  if (entries.length === 0) return null;

  return (
    <div className="chip-row game-links">
      {entries.map(({ key, label, url }) => {
        const Icon = ICONS[key];
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="chip-filter game-links__item"
          >
            <Icon size={14} />
            {label}
          </a>
        );
      })}
    </div>
  );
}
