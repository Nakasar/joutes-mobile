import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPlayGroupShowcase, setFollowingPlayGroup } from "../api/play-groups";
import { AnnouncementCard } from "../components/AnnouncementCard";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { UserContentCard } from "../components/UserContentCard";
import { UserMarkdown } from "../components/UserMarkdown";
import {
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  PinIcon,
  ScrollIcon,
  UserPlusIcon,
  UsersIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { isSafeUrl } from "../lib/safe-url";
import { readInitials } from "../lib/play-group-explore";
import { readPlayGroupAccent } from "../lib/play-group-theme";
import { useAuth } from "../store/auth";

/**
 * La vitrine publique d'un groupe.
 *
 * Se lit **sans compte**, et pour un groupe privé aussi : sa vitrine reste
 * ouverte à qui en a l'adresse — c'est ce qui permet d'inviter quelqu'un à la
 * regarder — et seule sa présence au rôle d'armes lui est retirée. Le cadenas
 * le dit, plutôt que de laisser croire à un groupe ordinaire.
 *
 * Rien de privé n'y passe : ni sondages, ni sessions, ni activité nominative.
 * **Les annonces n'y arrivent que si leur portée est publique** — c'est le
 * serveur qui filtre, et l'écran n'en connaît pas d'autres.
 */
export function PlayGroupShowcaseScreen() {
  const { t } = useTranslation();
  const { groupId = "" } = useParams();
  const { isAuthenticated } = useAuth();

  const showcase = useApi(() => getPlayGroupShowcase(groupId), [groupId]);
  const data = showcase.data ?? null;

  const [follow, setFollow] = useState<{
    following: boolean;
    followerCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const accent = useMemo(
    () =>
      data
        ? readPlayGroupAccent({ options: { theme: data.group.theme } })
        : { color: null, style: {} },
    [data],
  );

  const following = follow?.following ?? data?.isFollowing ?? false;
  const followerCount = follow?.followerCount ?? data?.followerCount ?? 0;

  async function toggleFollow() {
    if (!data) return;
    const next = !following;
    setBusy(true);
    // Optimiste : suivre une vitrine n'engage que celui qui touche, et le
    // faire attendre un aller-retour donnerait l'impression d'un bouton mort.
    setFollow({ following: next, followerCount: followerCount + (next ? 1 : -1) });

    try {
      setFollow(await setFollowingPlayGroup(groupId, next));
    } catch {
      setFollow({ following, followerCount });
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="screen">
        <BackHeader title={t("social.showcase.fallbackTitle")} />
        <StatusView
          loading={showcase.loading}
          error={showcase.error}
          onRetry={showcase.reload}
        />
      </div>
    );
  }

  const theme = data.group.theme;
  const links = (data.group.links ?? []).filter((link) => isSafeUrl(link.url));

  return (
    <div className="screen play-group-theme" style={accent.style}>
      <BackHeader
        title={data.group.name}
        action={
          isAuthenticated ? (
            <button
              className={`btn ${following ? "btn--outline" : "btn--grad"} follow-btn`}
              disabled={busy}
              onClick={toggleFollow}
            >
              {following ? <CheckIcon size={16} /> : <UserPlusIcon size={16} />}
              {following ? t("social.showcase.following") : t("social.showcase.follow")}
            </button>
          ) : undefined
        }
      />

      {theme?.banner && (
        <CachedImage src={theme.banner} alt="" className="group-hero__banner" />
      )}

      <div className="group-hero">
        {theme?.logo ? (
          <CachedImage src={theme.logo} alt="" className="group-crest group-crest--lg" />
        ) : (
          <span
            className="group-crest group-crest--lg group-crest--initials"
            style={theme?.accentColor ? { background: theme.accentColor } : undefined}
          >
            {readInitials(data.group.name)}
          </span>
        )}
        <div className="group-hero__body">
          <h1 className="group-hero__name">
            {data.group.name}
            {data.group.visibility === "private" && <LockIcon size={16} />}
          </h1>
          {theme?.tagline && <p className="group-hero__tagline">{theme.tagline}</p>}
          <div className="chip-row group-hero__badges">
            <span className="chip">
              <UsersIcon size={13} />
              {t("social.members", { count: data.group.memberCount ?? 0 })}
            </span>
            <span className="chip">{t("social.showcase.followers", { count: followerCount })}</span>
            {data.isMember && (
              <Link to={`/social/groups/${groupId}`} className="chip chip--accent">
                {t("social.showcase.openHub")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Un groupe privé le dit : celui qui a posé le réglage doit reconnaître
          lequel de ses groupes ne paraît plus au rôle d'armes. */}
      {data.group.visibility === "private" && (
        <p className="status muted">{t("social.showcase.privateNote")}</p>
      )}

      {data.group.description && (
        <section className="card">
          <UserMarkdown>{data.group.description}</UserMarkdown>
        </section>
      )}

      {data.lives.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.liveNow")}</p>
          {data.lives.map((live) => (
            <a
              key={live.id}
              href={live.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card profile-live"
            >
              <span className="live-dot" />
              <div>
                <p className="list-row__title">{live.title || live.streamer}</p>
                <p className="list-row__sub">
                  {[live.streamer, live.gameName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <ExternalLinkIcon size={16} />
            </a>
          ))}
        </>
      )}

      {data.group.rhythm?.label && (
        <section className="card">
          <p className="section-label">{t("social.groupDetail.rhythm")}</p>
          <p className="list-row__title">{data.group.rhythm.label}</p>
          {data.group.rhythm.defaultPlace?.label && (
            <p className="list-row__sub">
              <PinIcon size={13} />
              {data.group.rhythm.defaultPlace.label}
            </p>
          )}
        </section>
      )}

      {data.announcements.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.news")}</p>
          {data.announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              showScope={false}
            />
          ))}
        </>
      )}

      {data.contents.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.contents")}</p>
          {data.contents.map((content) => {
            const url = content.url && isSafeUrl(content.url) ? content.url : null;
            const body = (
              <>
                {content.thumbnail ? (
                  <CachedImage
                    src={content.thumbnail}
                    alt=""
                    className="content-card__thumb"
                  />
                ) : (
                  <span className="content-card__thumb content-card__thumb--empty">
                    <ScrollIcon size={20} />
                  </span>
                )}
                <div className="list-row__body">
                  <p className="list-row__title">{content.title}</p>
                  <p className="list-row__sub">
                    {[t(`profile.publications.kind.${content.kind}`), content.duration]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {content.summary && <p className="list-row__sub">{content.summary}</p>}
                </div>
              </>
            );

            // Un article du groupe n'a pas d'écran à lui : son corps est déjà
            // là, et l'ouvrir ailleurs demanderait une route pour rien.
            return url ? (
              <a
                key={content.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="list-row list-row--link content-card"
              >
                {body}
                <span className="chevron">
                  <ExternalLinkIcon size={16} />
                </span>
              </a>
            ) : (
              <details key={content.id} className="card content-article">
                <summary className="list-row content-card">{body}</summary>
                {content.body && <UserMarkdown>{content.body}</UserMarkdown>}
              </details>
            );
          })}
        </>
      )}

      {data.memberContents.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.memberContents")}</p>
          {data.memberContents.map((content) => (
            <UserContentCard
              key={content.id}
              content={content}
              userTag={content.authorId}
            />
          ))}
        </>
      )}

      {links.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.links")}</p>
          <div className="profile-links">
            {links.map((link, index) => (
              <a
                key={`${link.url}-${index}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="header-link"
              >
                <ExternalLinkIcon size={13} />
                {link.label || t(`lairs.about.network.${link.type}`)}
              </a>
            ))}
          </div>
        </>
      )}

      {data.games.length > 0 && (
        <>
          <p className="section-label">{t("social.showcase.games")}</p>
          {data.games.map((game) => (
            <div key={game.id} className="list-row">
              {game.icon && (
                <CachedImage src={game.icon} alt="" className="list-row__thumb" />
              )}
              <div className="list-row__body">
                <p className="list-row__title">{game.name}</p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
