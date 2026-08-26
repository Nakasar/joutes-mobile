import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listPlayGroups } from "../api/play-groups";
import { listFriendRequests, listFriends } from "../api/social";
import type { PlayGroup, PublicUser } from "../api/types";
import { GroupEscu } from "../components/GroupEscu";
import { LairsList } from "../components/LairsList";
import { Movement } from "../components/Movement";
import {
  ChevronIcon,
  SwordsIcon,
  UserPlusIcon,
  UsersIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, initialsOf, tintStyle } from "../lib/game-visuals";
import { readPlayGroupAccent } from "../lib/play-group-theme";
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

      <Movement
        section
        title={t("social.myGroups")}
        aside={groups.data ? String(groups.data.length) : undefined}
      />

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
        const accent = readPlayGroupAccent(group);
        return (
          <Link
            key={group.id}
            to={`/social/groups/${group.id}`}
            className="friend-row play-group-theme"
            style={accent.style}
          >
            {/* Le blason, comme au rôle d'armes : un groupe se reconnaît à son
                écu avant son nom, et ce doit être le même écu des deux côtés.
                `GroupEscu` attend des champs aplatis que seule l'exploration
                sert — ici ils se lisent sous `options.theme`, et les initiales
                se dérivent du nom. */}
            <GroupEscu
              initials={initialsOf(group.name)}
              logo={group.options?.theme?.logo}
              accentColor={group.options?.theme?.accentColor}
              size="md"
            />
            <div className="friend-row__body">
              <p className="friend-row__name">{group.name}</p>
              <p className="friend-row__sub">
                {t("social.members", { count: membersCount(group) })}
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

/**
 * L'annuaire, servi ici même.
 *
 * L'onglet ouvrait sur un lien vers `/lairs`, suivi d'une liste amputée : une
 * trentaine de lieux, sans recherche, sans filtre, sans le partage ouvert /
 * fermé. On y cherchait une boutique et il fallait d'abord comprendre qu'il
 * fallait cliquer ailleurs pour chercher. C'est le même écran, il est donc
 * rendu tel quel.
 *
 * Ce qui se perd au passage : `listLairs()` était mis en cache sous
 * `social:lairs` et rouvrait l'onglet hors ligne, là où `searchLairs()` de
 * l'annuaire n'a pas de cache. C'est le prix de l'écran unique, et il se
 * rembourse en donnant un cache à la recherche plutôt qu'en gardant deux vues.
 */
function LairsTab() {
  return <LairsList />;
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
