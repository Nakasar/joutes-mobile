import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { FeedEntry } from "../api/types";
import { currentLocale } from "../i18n";
import { formatRelative, SOCIAL_PLATFORM_LABELS } from "../lib/game-links";
import { externalUrl } from "../lib/lair-urls";
import { CachedImage } from "./CachedImage";
import {
  BlueskyIcon,
  ChevronIcon,
  ExternalLinkIcon,
  InstagramIcon,
  LayersIcon,
  PlayIcon,
  ScrollIcon,
  XIcon,
  YoutubeIcon,
} from "./icons";

const PLATFORM_ICONS = {
  bluesky: BlueskyIcon,
  youtube: YoutubeIcon,
  x: XIcon,
  instagram: InstagramIcon,
} as const;

/** Le genre d'une entrée tel que le fil le nomme — celui de ses puces. */
export type FeedGenre = "actu" | "video" | "deck" | "social";

export function feedGenre(entry: FeedEntry): FeedGenre {
  switch (entry.type) {
    case "news":
      return "actu";
    case "content":
      return entry.kind === "article" ? "actu" : "video";
    case "deck":
      return "deck";
    case "social":
      return "social";
  }
}

/**
 * Une entrée du fil, quelle que soit son origine : la vignette, le genre en
 * puce, le titre, qui publie et depuis quand. Ce qui vit sur Joutes s'ouvre
 * dans l'application ; une vidéo ou une publication d'un réseau sort dans le
 * navigateur, et la carte le dit par son icône.
 */
export function FeedCard({ entry, gameName }: { entry: FeedEntry; gameName?: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const genre = feedGenre(entry);
  const thumbnail = externalUrl(entry.thumbnail);

  const meta = [gameName, entry.source, formatRelative(entry.publishedAt, locale)]
    .filter(Boolean)
    .join(" · ");

  const media = thumbnail ? (
    <span className="feed-card__media">
      {entry.type === "social" ? (
        <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <CachedImage
          src={thumbnail}
          alt=""
          loading="lazy"
          style={entry.type === "deck" ? { objectPosition: entry.framing } : undefined}
        />
      )}
      {(genre === "video" || (entry.type === "social" && entry.kind !== "post")) && (
        <span className="feed-card__play">
          <PlayIcon size={16} />
        </span>
      )}
      {"duration" in entry && entry.duration && (
        <span className="feed-card__duration">{entry.duration}</span>
      )}
    </span>
  ) : (
    <span className="feed-card__media feed-card__media--empty">
      {entry.type === "deck" ? <LayersIcon size={20} /> : <ScrollIcon size={20} />}
    </span>
  );

  const body = (
    <>
      {media}
      <span className="feed-card__body">
        <span className="feed-card__genre">
          {entry.type === "social" ? (
            <>
              {(() => {
                const Icon = PLATFORM_ICONS[entry.platform];
                return <Icon size={11} />;
              })()}
              {SOCIAL_PLATFORM_LABELS[entry.platform]}
            </>
          ) : (
            t(`home.feed.types.${genre}`)
          )}
        </span>
        <span className="feed-card__title">{entry.title}</span>
        <span className="feed-card__meta">{meta}</span>
      </span>
    </>
  );

  const external =
    entry.type === "social"
      ? externalUrl(entry.url)
      : entry.type === "content" && entry.kind !== "article"
        ? externalUrl(entry.url)
        : null;

  if (external) {
    return (
      <a
        href={external}
        target="_blank"
        rel="noopener noreferrer"
        className="feed-card"
        aria-label={
          entry.type === "social"
            ? t("gameHub.social.openOn", { platform: SOCIAL_PLATFORM_LABELS[entry.platform] })
            : undefined
        }
      >
        {body}
        <span className="chevron">
          <ExternalLinkIcon size={16} />
        </span>
      </a>
    );
  }

  const to =
    entry.type === "news"
      ? `/news/${entry.id}`
      : entry.type === "deck"
        ? `/decks/${entry.id}`
        : entry.type === "content"
          ? `/users/${encodeURIComponent(entry.authorId)}/contents/${encodeURIComponent(entry.id)}`
          : null;

  if (!to) return <div className="feed-card">{body}</div>;

  return (
    <Link to={to} className="feed-card">
      {body}
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}
