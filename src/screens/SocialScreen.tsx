import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { listLairs } from "../api/lairs";
import { listPlayGroups } from "../api/play-groups";
import { listFriendRequests, listFriends } from "../api/social";
import type { PlayGroup, PublicUser } from "../api/types";
import { LairCard } from "../components/LairCard";
import {
  ChevronIcon,
  PinIcon,
  SwordsIcon,
  UserPlusIcon,
  UsersIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userProfilePath } from "../lib/user-tag";
import { useAuth } from "../store/auth";

type Tab = "amis" | "groups" | "lairs";

function friendName(u: PublicUser, fallback: string): string {
  return u.displayName || u.username || fallback;
}
function friendTag(u: PublicUser): string {
  if (u.username) return `@${u.username}`;
  if (u.discriminator) return `#${u.discriminator}`;
  return "";
}

/**
 * L'entrée du registre, en tête de l'onglet Amis.
 *
 * C'est là qu'on va chercher les gens qu'on n'a pas encore, donc là qu'elle se
 * pose — plutôt que d'occuper une sixième place dans la barre du bas. Au-dessus
 * du portillon : le registre est public, et se le voir refuser serait absurde.
 */
function RegistryLink() {
  const { t } = useTranslation();
  return (
    <Link to="/players" className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <UsersIcon size={18} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{t("players.title")}</p>
        <p className="list-row__sub">{t("players.entrySub")}</p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

function AuthGate() {
  const { t } = useTranslation();
  return (
    <div className="card gate">
      <h2 className="gate__title">{t("common.loginRequiredTitle")}</h2>
      <p className="gate__text">{t("social.gateText")}</p>
      <Link to="/login" className="btn btn--grad btn--block">
        {t("common.signIn")}
      </Link>
    </div>
  );
}

function FriendsTab() {
  const { t } = useTranslation();
  const friends = useApi(() => listFriends());
  const requests = useApi(() => listFriendRequests());
  const reqCount = requests.data?.length ?? 0;

  return (
    <>
      {reqCount > 0 && (
        <div className="request-banner">
          <span className="request-banner__count">{reqCount}</span>
          <div className="request-banner__body">
            <p className="request-banner__title">{t("social.requestsTitle")}</p>
            <p className="request-banner__sub">
              {t("social.requestsSub", { count: reqCount })}
            </p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </div>
      )}

      <p className="section-label">
        {t("social.myFriends", { count: friends.data?.length ?? 0 })}
      </p>
      <StatusView
        loading={friends.loading}
        error={friends.error}
        onRetry={friends.reload}
        empty={
          friends.data && friends.data.length === 0
            ? t("social.friendsEmpty")
            : undefined
        }
      />
      {friends.data?.map((friend) => {
        const color = colorFor(friend.id);
        return (
          <Link
            key={friend.id}
            to={userProfilePath(friend)}
            className="friend-row"
          >
            <div className="friend-row__avatar">
              {friend.avatar ? (
                <img
                  src={friend.avatar}
                  alt=""
                  className="avatar avatar--sm"
                  loading="lazy"
                />
              ) : (
                <span className="avatar avatar--sm" style={tintStyle(color)}>
                  {initialOf(friendName(friend, t("social.friendDefault")))}
                </span>
              )}
            </div>
            <div className="friend-row__body">
              <p className="friend-row__name">
                {friendName(friend, t("social.friendDefault"))}
              </p>
              <p className="friend-row__sub">{friendTag(friend)}</p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
        );
      })}
    </>
  );
}

function membersCount(group: PlayGroup): number {
  return group.members?.length ?? 0;
}

function GroupsTab() {
  const { t } = useTranslation();
  const groups = useApi(() => listPlayGroups());
  return (
    <>
      {/* L'onglet ne montre que ses propres groupes : le rôle d'armes, où l'on
          en découvre d'autres, s'ouvre au-dessus. */}
      <Link to="/social/groups/explore" className="list-row list-row--link">
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <SwordsIcon size={18} />
        </span>
        <div className="list-row__body">
          <p className="list-row__title">{t("social.explore.title")}</p>
          <p className="list-row__sub">{t("social.explore.entrySub")}</p>
        </div>
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>

      <StatusView
        loading={groups.loading}
        error={groups.error}
        onRetry={groups.reload}
        empty={
          groups.data && groups.data.length === 0
            ? t("social.groupsEmpty")
            : undefined
        }
      />
      {groups.data?.map((group) => {
        const color = colorFor(group.id);
        const n = membersCount(group);
        return (
          <Link key={group.id} to={`/social/groups/${group.id}`} className="friend-row">
            <span className="avatar avatar--sm" style={tintStyle(color)}>
              {initialOf(group.name)}
            </span>
            <div className="friend-row__body">
              <p className="friend-row__name">{group.name}</p>
              <p className="friend-row__sub">
                {t("social.members", { count: n })}
                {group.enabledGameIds && group.enabledGameIds.length > 0
                  ? ` · ${t("social.groupGames", { count: group.enabledGameIds.length })}`
                  : ""}
              </p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
        );
      })}
    </>
  );
}

function LairsTab() {
  const { t } = useTranslation();
  const lairs = useApi(() => listLairs());
  const games = useApi(() => listGames());
  const gameName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of games.data ?? []) map.set(g._id, g.name);
    return map;
  }, [games.data]);

  return (
    <>
      {/* L'onglet n'affiche qu'une trentaine de lieux, sans filtre : l'annuaire
          complet, avec sa recherche, s'ouvre au-dessus. */}
      <Link to="/lairs" className="list-row list-row--link">
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <PinIcon size={18} />
        </span>
        <div className="list-row__body">
          <p className="list-row__title">{t("lairs.title")}</p>
          <p className="list-row__sub">{t("lairs.entrySub")}</p>
        </div>
        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </Link>

      <StatusView
        loading={lairs.loading}
        error={lairs.error}
        onRetry={lairs.reload}
        empty={
          lairs.data && lairs.data.lairs.length === 0
            ? t("social.lairsEmpty")
            : undefined
        }
      />
      {lairs.data?.lairs.map((lair) => (
        <LairCard
          key={lair.id}
          lair={lair}
          gameNames={(lair.games ?? [])
            .map((id) => gameName.get(id))
            .filter((name): name is string => Boolean(name))}
        />
      ))}
    </>
  );
}

export function SocialScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("amis");

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("social.title")}</h1>
        </div>
        <div className="head-actions">
          <button
            className="icon-button icon-button--primary"
            aria-label={t("social.addFriend")}
          >
            <UserPlusIcon size={20} />
          </button>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={`segmented__item${tab === "amis" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("amis")}
        >
          {t("social.tabFriends")}
        </button>
        <button
          className={`segmented__item${tab === "groups" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("groups")}
        >
          {t("social.tabGroups")}
        </button>
        <button
          className={`segmented__item${tab === "lairs" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("lairs")}
        >
          {t("social.tabLairs")}
        </button>
      </div>

      {tab === "amis" && <RegistryLink />}
      {tab === "amis" && (isAuthenticated ? <FriendsTab /> : <AuthGate />)}
      {tab === "groups" && (isAuthenticated ? <GroupsTab /> : <AuthGate />)}
      {tab === "lairs" && <LairsTab />}
    </div>
  );
}
