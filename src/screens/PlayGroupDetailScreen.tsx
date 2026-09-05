import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPlayGroupCollectionOverview, recomputeCollectionValue } from "../api/collection";
import {
  getPlayGroup,
  listPlayGroupAnnouncements,
  listPlayGroupSessions,
} from "../api/play-groups";
import type { PlayGroupSession } from "../api/types";
import { AnnouncementCard } from "../components/AnnouncementCard";
import { BackHeader } from "../components/BackHeader";
import { CollectionValueCard } from "../components/CollectionValueCard";
import { CreateSessionSheet } from "../components/CreateSessionSheet";
import { SessionCard } from "../components/SessionCard";
import { UserMarkdown } from "../components/UserMarkdown";
import {
  ChevronIcon,
  ExternalLinkIcon,
  HeartIcon,
  LockIcon,
  PlusIcon,
  TagIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { canManagePlayGroup, readMemberRole } from "../lib/play-group-access";
import { readPlayGroupAccent } from "../lib/play-group-theme";
import { useAuth } from "../store/auth";

const VIEWS = ["etabli", "sessions", "announcements", "lists", "members"] as const;
type View = (typeof VIEWS)[number];

/** La prochaine session confirmée : celle qui attend encore une réponse. */
function nextSession(sessions: PlayGroupSession[]): PlayGroupSession | undefined {
  const now = new Date().toISOString();
  return sessions
    .filter((session) => session.status === "confirmed")
    .filter((session) => (session.endsAt ?? session.startsAt ?? "") >= now)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))[0];
}

function PlayGroupDetailContent({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useSearchParamState<View>("view", VIEWS, "etabli");
  const [creating, setCreating] = useState(false);

  const group = useApi(() => getPlayGroup(groupId), [groupId]);
  const overview = useApi(() => getPlayGroupCollectionOverview(groupId), [groupId]);

  const role = group.data ? readMemberRole(group.data, user?.id) : null;
  const canManage = canManagePlayGroup(role);
  const accent = useMemo(
    () => (group.data ? readPlayGroupAccent(group.data) : { color: null, style: {} }),
    [group.data],
  );

  // Les sessions et les annonces ne sont pas mémorisées : elles portent des
  // votes et des réponses de présence, et une liste servie depuis le cache
  // ferait croire à un vote enregistré. C'est aussi pourquoi elles se
  // rechargent d'elles-mêmes à chaque écriture, par `reload`.
  const sessions = useApi(() => listPlayGroupSessions(groupId), [groupId]);
  const announcements = useApi(() => listPlayGroupAnnouncements(groupId), [groupId]);

  // Le serveur rend la session entière après chaque vote ou réponse : on la
  // pose par-dessus la liste chargée plutôt que de tout relire, ce qui ferait
  // clignoter les cartes sous les doigts. La clé est effacée au rechargement
  // suivant, la liste fraîche faisant alors autorité.
  const [patched, setPatched] = useState<Record<string, PlayGroupSession>>({});

  const allSessions = (sessions.data ?? []).map(
    (session) => patched[session.id] ?? session,
  );

  const upcoming = nextSession(allSessions);
  const games = overview.data?.games.filter((game) => game !== null) ?? [];

  function sessionChanged(updated: PlayGroupSession) {
    setPatched((previous) => ({ ...previous, [updated.id]: updated }));
  }

  function reloadSessions() {
    setPatched({});
    sessions.reload();
  }

  return (
    <div className="screen play-group-theme" style={accent.style}>
      <BackHeader
        title={group.data?.name ?? t("social.groupDetail.fallbackTitle")}
        action={
          <Link
            to={`/social/groups/${groupId}/showcase`}
            className="btn btn--outline follow-btn"
          >
            <ExternalLinkIcon size={14} />
            {t("social.groupDetail.showcaseAction")}
          </Link>
        }
      />

      <StatusView loading={group.loading} error={group.error} onRetry={group.reload} />

      {group.data && (
        <>
          <div className="segmented segmented--scroll" style={{ marginBottom: 14 }}>
            {VIEWS.map((key) => (
              <button
                key={key}
                className={`segmented__item${view === key ? " segmented__item--active" : ""}`}
                onClick={() => setView(key)}
              >
                {t(`social.groupDetail.views.${key}`)}
              </button>
            ))}
          </div>

          {view === "etabli" && (
            <>
              {group.data.description && (
                <section className="card">
                  {/* La description est du markdown écrit par le groupe, et la
                      vitrine la rend déjà comme telle : la laisser en texte brut
                      ici afficherait les astérisques et perdrait les liens. */}
                  <UserMarkdown>{group.data.description}</UserMarkdown>
                </section>
              )}

              {group.data.options?.rhythm?.label && (
                <section className="card">
                  <p className="section-label">{t("social.groupDetail.rhythm")}</p>
                  <p className="list-row__title">{group.data.options.rhythm.label}</p>
                </section>
              )}

              <p className="section-label">{t("social.sessions.next")}</p>
              <StatusView
                loading={sessions.loading}
                error={sessions.error}
                onRetry={reloadSessions}
                empty={
                  !sessions.loading && !sessions.error && !upcoming
                    ? t("social.sessions.noneUpcoming")
                    : undefined
                }
              />
              {upcoming && (
                <SessionCard
                  session={upcoming}
                  playGroupId={groupId}
                  userId={user?.id ?? null}
                  canManage={canManage}
                  onChanged={sessionChanged}
                />
              )}

              {(announcements.data?.length ?? 0) > 0 && (
                <>
                  <p className="section-label">{t("social.announcements.title")}</p>
                  {announcements.data?.slice(0, 2).map((announcement) => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} />
                  ))}
                </>
              )}
            </>
          )}

          {view === "sessions" && (
            <>
              <button
                className="btn btn--grad btn--block"
                style={{ marginBottom: 14 }}
                onClick={() => setCreating(true)}
              >
                <PlusIcon size={16} />
                {t("social.sessions.create.action")}
              </button>

              <StatusView
                loading={sessions.loading}
                error={sessions.error}
                onRetry={reloadSessions}
                empty={
                  sessions.data && sessions.data.length === 0
                    ? t("social.sessions.empty")
                    : undefined
                }
              />
              {allSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  playGroupId={groupId}
                  userId={user?.id ?? null}
                  canManage={canManage}
                  onChanged={sessionChanged}
                />
              ))}
            </>
          )}

          {view === "announcements" && (
            <>
              <StatusView
                loading={announcements.loading}
                error={announcements.error}
                onRetry={announcements.reload}
                empty={
                  announcements.data && announcements.data.length === 0
                    ? t("social.announcements.empty")
                    : undefined
                }
              />
              {announcements.data?.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
              {/* Publier reste web : le formulaire demande une portée, un
                  corps en markdown et une relecture, et se tape mal au pouce. */}
              {canManage && (
                <p className="status muted">{t("social.announcements.publishOnWeb")}</p>
              )}
            </>
          )}

          {view === "lists" && (
            <>
              <Link
                to={`/social/groups/${groupId}/wishlists`}
                className="list-row list-row--link"
              >
                <span className="list-row__icon" style={{ background: "var(--chip)" }}>
                  <HeartIcon size={20} style={{ color: "var(--primary)" }} />
                </span>
                <div className="list-row__body">
                  <p className="list-row__title">{t("social.groupDetail.wishlistsAction")}</p>
                </div>
                <span className="chevron">
                  <ChevronIcon size={18} />
                </span>
              </Link>
              <Link
                to={`/social/groups/${groupId}/sell-list`}
                className="list-row list-row--link"
              >
                <span className="list-row__icon" style={{ background: "var(--chip)" }}>
                  <TagIcon size={20} style={{ color: "var(--primary)" }} />
                </span>
                <div className="list-row__body">
                  <p className="list-row__title">{t("social.groupDetail.sellListAction")}</p>
                </div>
                <span className="chevron">
                  <ChevronIcon size={18} />
                </span>
              </Link>

              <p className="section-label">{t("social.groupDetail.collectionTitle")}</p>
              <StatusView
                loading={overview.loading}
                error={overview.error}
                onRetry={overview.reload}
                empty={
                  overview.data && games.length === 0
                    ? t("social.groupDetail.collectionEmpty")
                    : undefined
                }
              />
              {/* La collection est commune : n'importe quel membre peut en
                  redemander la valeur. */}
              {overview.data && games.length > 0 && (
                <CollectionValueCard
                  value={overview.data.value}
                  copies={overview.data.totalCopies}
                  onRecompute={async () => {
                    await recomputeCollectionValue(groupId);
                    overview.reload();
                  }}
                />
              )}
              {games.map((game) => {
                const percent =
                  game.gameTotal > 0
                    ? Math.round((game.gameOwned / game.gameTotal) * 100)
                    : 0;
                const color = colorFor(game.slug, game.color);
                const body = (
                  <>
                    <div className="collection-game__head">
                      <span className="avatar avatar--sm" style={tintStyle(color)}>
                        {initialOf(game.name)}
                      </span>
                      <div className="collection-game__body">
                        <h2 className="collection-game__name">{game.name}</h2>
                        <p className="collection-game__sub">
                          {t("collection.gameStats", {
                            count: game.copies,
                            owned: game.gameOwned,
                            total: game.gameTotal,
                            copies: game.copies,
                          })}
                        </p>
                      </div>
                      <span className="collection-game__pct" style={{ color }}>
                        {percent}%
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress__bar"
                        style={{ width: `${percent}%`, background: color }}
                      />
                    </div>
                  </>
                );
                return game.slug ? (
                  <Link
                    key={game.gameId}
                    to={`/social/groups/${groupId}/collection/${game.slug}`}
                    className="collection-game collection-game--link"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={game.gameId} className="collection-game">
                    {body}
                  </div>
                );
              })}
            </>
          )}

          {view === "members" && (
            <>
              <p className="section-label">
                {t("social.members", {
                  count: group.data.members?.length ?? group.data.memberCount ?? 0,
                })}
              </p>
              {(group.data.members ?? []).map((member) => {
                const name =
                  member.user?.displayName ||
                  member.user?.username ||
                  t("social.friendDefault");
                const color = colorFor(member.userId ?? name);
                return (
                  <div key={member.userId ?? name} className="friend-row">
                    {member.user?.avatar ? (
                      <img
                        src={member.user.avatar}
                        alt=""
                        className="avatar avatar--sm"
                        loading="lazy"
                      />
                    ) : (
                      <span className="avatar avatar--sm" style={tintStyle(color)}>
                        {initialOf(name)}
                      </span>
                    )}
                    <div className="friend-row__body">
                      <p className="friend-row__name">{name}</p>
                      <p className="friend-row__sub">
                        {t(`social.groupDetail.role.${member.role ?? "member"}`, {
                          defaultValue: member.role ?? "",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Inviter, promouvoir, exclure : l'API existe, mais ce sont des
                  gestes irréversibles dont la confirmation se lit mal au pouce.
                  Ils restent sur le web, et l'écran le dit plutôt que de
                  laisser chercher. */}
              {canManage && (
                <p className="status muted">{t("social.groupDetail.manageOnWeb")}</p>
              )}
            </>
          )}
        </>
      )}

      {creating && (
        <CreateSessionSheet
          playGroupId={groupId}
          onClose={() => setCreating(false)}
          onCreated={reloadSessions}
        />
      )}
    </div>
  );
}

/**
 * L'Établi d'un groupe : ce que ses membres y font.
 *
 * Cinq vues plutôt qu'une page à dérouler — sessions, annonces, listes et
 * membres n'ont pas la même urgence, et la première d'entre elles, « Établi »,
 * ne montre que ce qui attend une réponse : la prochaine session et les deux
 * dernières annonces.
 */
export function PlayGroupDetailScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { groupId = "" } = useParams();

  if (!isAuthenticated) {
    return (
      <div className="screen">
        <BackHeader title={t("social.groupDetail.fallbackTitle")} />
        <div className="card gate">
          <div className="gate__icon">
            <LockIcon size={30} />
          </div>
          <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
          <p className="gate__text">{t("social.gateText")}</p>
          {/* La vitrine, elle, se lit sans compte : le portillon y renvoie. */}
          <Link to={`/social/groups/${groupId}/showcase`} className="btn btn--outline btn--block">
            {t("social.groupDetail.showcaseAction")}
          </Link>
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return <PlayGroupDetailContent groupId={groupId} />;
}
