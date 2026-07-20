import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listGames } from "../api/games";
import {
  listFriendRequests,
  listFriends,
  listLairs,
  listPlayGroups,
} from "../api/social";
import type { PlayGroup, PublicUser } from "../api/types";
import { ChevronIcon, PinIcon, UserPlusIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { useAuth } from "../store/auth";

type Tab = "amis" | "groups" | "lairs";

function friendName(u: PublicUser): string {
  return u.displayName || u.username || "Joueur";
}
function friendTag(u: PublicUser): string {
  if (u.username) return `@${u.username}`;
  if (u.discriminator) return `#${u.discriminator}`;
  return "";
}

function AuthGate() {
  return (
    <div className="card gate">
      <h2 className="gate__title">Connexion requise</h2>
      <p className="gate__text">
        Connectez-vous pour retrouver vos amis et vos groupes de jeu.
      </p>
      <Link to="/login" className="btn btn--grad btn--block">
        Se connecter
      </Link>
    </div>
  );
}

function FriendsTab() {
  const friends = useApi(() => listFriends());
  const requests = useApi(() => listFriendRequests());
  const reqCount = requests.data?.length ?? 0;

  return (
    <>
      {reqCount > 0 && (
        <div className="request-banner">
          <span className="request-banner__count">{reqCount}</span>
          <div className="request-banner__body">
            <p className="request-banner__title">Demandes d'amis</p>
            <p className="request-banner__sub">
              {reqCount} joueur{reqCount > 1 ? "s veulent" : " veut"} vous
              ajouter
            </p>
          </div>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </div>
      )}

      <p className="section-label">Mes amis · {friends.data?.length ?? 0}</p>
      <StatusView
        loading={friends.loading}
        error={friends.error}
        onRetry={friends.reload}
        empty={
          friends.data && friends.data.length === 0
            ? "Vous n'avez pas encore d'amis."
            : undefined
        }
      />
      {friends.data?.map((friend) => {
        const color = colorFor(friend.id);
        return (
          <div key={friend.id} className="friend-row">
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
                  {initialOf(friendName(friend))}
                </span>
              )}
            </div>
            <div className="friend-row__body">
              <p className="friend-row__name">{friendName(friend)}</p>
              <p className="friend-row__sub">{friendTag(friend)}</p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </div>
        );
      })}
    </>
  );
}

function membersCount(group: PlayGroup): number {
  return group.members?.length ?? 0;
}

function GroupsTab() {
  const groups = useApi(() => listPlayGroups());
  return (
    <>
      <StatusView
        loading={groups.loading}
        error={groups.error}
        onRetry={groups.reload}
        empty={
          groups.data && groups.data.length === 0
            ? "Vous n'êtes dans aucun groupe."
            : undefined
        }
      />
      {groups.data?.map((group) => {
        const color = colorFor(group.id);
        const n = membersCount(group);
        return (
          <div key={group.id} className="friend-row">
            <span className="avatar avatar--sm" style={tintStyle(color)}>
              {initialOf(group.name)}
            </span>
            <div className="friend-row__body">
              <p className="friend-row__name">{group.name}</p>
              <p className="friend-row__sub">
                {n} membre{n > 1 ? "s" : ""}
                {group.enabledGameIds && group.enabledGameIds.length > 0
                  ? ` · ${group.enabledGameIds.length} jeu${group.enabledGameIds.length > 1 ? "x" : ""}`
                  : ""}
              </p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </div>
        );
      })}
    </>
  );
}

function LairsTab() {
  const lairs = useApi(() => listLairs());
  const games = useApi(() => listGames());
  const gameName = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of games.data ?? []) map.set(g._id, g.name);
    return map;
  }, [games.data]);

  return (
    <>
      <StatusView
        loading={lairs.loading}
        error={lairs.error}
        onRetry={lairs.reload}
        empty={
          lairs.data && lairs.data.lairs.length === 0
            ? "Aucune boutique."
            : undefined
        }
      />
      {lairs.data?.lairs.map((lair) => (
        <div key={lair.id} className="lair-card">
          <div className="lair-card__media">
            {lair.banner ? (
              <img src={lair.banner} alt="" loading="lazy" />
            ) : (
              <div className="shimmer" style={{ width: "100%", height: "100%" }} />
            )}
          </div>
          <div className="lair-card__body">
            <h2 className="lair-card__name">{lair.name}</h2>
            {lair.address && (
              <p className="lair-card__where">
                <PinIcon size={14} />
                {lair.address}
              </p>
            )}
            {(() => {
              const names = (lair.games ?? [])
                .map((id) => gameName.get(id))
                .filter((n): n is string => Boolean(n));
              return names.length > 0 ? (
                <p className="lair-card__games">{names.join(" · ")}</p>
              ) : null;
            })()}
          </div>
        </div>
      ))}
    </>
  );
}

export function SocialScreen() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("amis");

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">Communauté</h1>
        </div>
        <div className="head-actions">
          <button
            className="icon-button icon-button--primary"
            aria-label="Ajouter un ami"
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
          Amis
        </button>
        <button
          className={`segmented__item${tab === "groups" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("groups")}
        >
          Groupes
        </button>
        <button
          className={`segmented__item${tab === "lairs" ? " segmented__item--active" : ""}`}
          onClick={() => setTab("lairs")}
        >
          Boutiques
        </button>
      </div>

      {tab === "amis" && (isAuthenticated ? <FriendsTab /> : <AuthGate />)}
      {tab === "groups" && (isAuthenticated ? <GroupsTab /> : <AuthGate />)}
      {tab === "lairs" && <LairsTab />}
    </div>
  );
}
