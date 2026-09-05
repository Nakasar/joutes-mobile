import { useTranslation } from "react-i18next";
import type { GameSocialPost } from "../api/types";
import { currentLocale } from "../i18n";
import { formatRelative, formatSocialDuration, SOCIAL_PLATFORM_LABELS } from "../lib/game-links";
import { externalUrl } from "../lib/lair-urls";
import { BlueskyIcon, InstagramIcon, PlayIcon, XIcon, YoutubeIcon } from "./icons";

const PLATFORM_ICONS = {
  bluesky: BlueskyIcon,
  youtube: YoutubeIcon,
  x: XIcon,
  instagram: InstagramIcon,
} as const;

/**
 * Une publication d'un réseau de l'éditeur, en vignette.
 *
 * Ce qui est affiché vient d'un tiers, et cela dicte trois choses, comme sur
 * le site : le texte est rendu en texte brut, la miniature passe par
 * `externalUrl` au rendu, et le lien sort dans le navigateur. La vignette est
 * un `<img>` ordinaire et non `CachedImage` : l'hôte de la plateforme n'est
 * pas dans l'allowlist du plugin HTTP, et il n'a pas à y entrer pour une image.
 */
export function SocialPostCard({ post }: { post: GameSocialPost }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const thumbnail = externalUrl(post.thumbnail);
  const url = externalUrl(post.url);
  const Icon = PLATFORM_ICONS[post.platform];
  const duration = formatSocialDuration(post.durationSeconds);
  const isVideo = post.kind !== "post";

  const body = (
    <>
      {thumbnail && (
        <span className="social-post__media">
          <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
          {isVideo && (
            <span className="social-post__play">
              <PlayIcon size={18} />
            </span>
          )}
          {duration && <span className="social-post__duration">{duration}</span>}
        </span>
      )}
      <span className="social-post__body">
        {post.text && <span className="social-post__text">{post.text}</span>}
        <span className="social-post__meta">
          <Icon size={13} />
          <span className="social-post__handle">{post.account.handle}</span>
          <span className="social-post__date">· {formatRelative(post.publishedAt, locale)}</span>
        </span>
      </span>
    </>
  );

  if (!url) return <article className="social-post">{body}</article>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="social-post"
      aria-label={t("gameHub.social.openOn", { platform: SOCIAL_PLATFORM_LABELS[post.platform] })}
    >
      {body}
    </a>
  );
}
