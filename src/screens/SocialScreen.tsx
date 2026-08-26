import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import { listPlayGroups } from "../api/play-groups";
import { listFriendRequests, listFriends } from "../api/social";
import type { PlayGroup, PublicUser } from "../api/types";
import { GroupEscu } from "../components/GroupEscu";
import { LairsList } from "../components/LairsList";
import { Movement } from "../components/Movement";
import {
  ChevronIcon,
  PinIcon,
  RepeatIcon,
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

/** Le serveur sert `memberCount` à tout le monde et `members` aux seuls
 *  membres : lire la liste seule rendait zéro dès qu'elle manquait. */
function membersCount(group: PlayGroup): number {
  return group.memberCount ?? group.members?.length ?? 0;
}

/**
 * Un groupe dont je suis membre, au rôle d'armes.
 *
 * Même entrée que sur l'exploration — écu, nom en héraldique, devise, rythme,
 * jeux, comptes — parce que c'est le même objet : un groupe se lit de la même
 * façon qu'on le découvre ou qu'on y soit déjà. Ce qui change tient à ce que
 * chaque route sert : l'exploration donne le dernier fait d'armes et le bouton
 * « Suivre », `GET /play-groups` donne mon rôle et me mène à l'Établi.
 *
 * `ExploreGroup` arrive aplati par le serveur ; `PlayGroup` est imbriqué et
 * tout-optionnel. D'où la lecture sous `options.theme`, les initiales dérivées
 * du nom, et les noms de jeux rapprochés depuis le catalogue — le groupe n'en
 * porte que les identifiants.
 */
function GroupRollEntry({ group, gameNames }: { group: PlayGroup; gameNames: string[] }) {
  const { t } = useTranslation();

  const accent = readPlayGroupAccent(group);
  const theme = group.options?.theme;
  const rhythm = group.options?.rhythm;
  const live = group.options?.lives?.[0];

  return (
    <article className="roll-entry play-group-theme" style={accent.style}>
      <GroupEscu
        initials={initialsOf(group.name)}
        logo={theme?.logo}
        accentColor={theme?.accentColor}
        live={Boolean(live)}
        liveLabel={t("social.explore.live")}
        size="lg"
      />

      <div className="roll-entry__body">
        <h3 className="roll-entry__name">
          <Link to={`/social/groups/${group.id}`}>{group.name}</Link>

          {/* Mon rôle plutôt que la visibilité : sur ce rôle-ci, tous les
              groupes sont les miens — ce qui les distingue est ce que j'y
              suis. Le sceau garde la forme de celui du privé. */}
          {group.role && (
            <span className="roll-entry__seal">
              {t(`social.groupDetail.role.${group.role}`)}
            </span>
          )}
        </h3>

        {theme?.tagline && <p className="roll-entry__tagline">{theme.tagline}</p>}

        {/* Le cri ne dit que le direct : `GET /play-groups` ne sert pas de
            dernier fait d'armes, et « pas de nouvelle depuis un moment » sur
            chacun de ses propres groupes serait un reproche, pas une
            information. Muet, la ligne disparaît. */}
        {live && (
          <p className="roll-entry__cry roll-entry__cry--live">
            <span className="live-dot" aria-hidden />
            {t("social.explore.entry.liveCryPlain", { streamer: live.streamer })}
          </p>
        )}

        {(rhythm?.label || rhythm?.defaultPlace?.label) && (
          <div className="roll-entry__meta">
            {rhythm?.label && (
              <span>
                <RepeatIcon size={13} />
                {rhythm.label}
              </span>
            )}
            {rhythm?.defaultPlace?.label && (
              <span>
                <PinIcon size={13} />
                {rhythm.defaultPlace.label}
              </span>
            )}
          </div>
        )}

        {gameNames.length > 0 && (
          <p className="roll-entry__games">{gameNames.slice(0, 3).join(" · ")}</p>
        )}
      </div>

      <div className="roll-entry__foot">
        <div className="roll-entry__tally">
          <span>
            <b>{membersCount(group)}</b>
            {t("social.explore.entry.members", { count: membersCount(group) })}
          </span>
          {typeof group.followerCount === "number" && (
            <span>
              <b>{group.followerCount}</b>
              {t("social.explore.entry.followers", { count: group.followerCount })}
            </span>
          )}
        </div>

        <div className="roll-entry__actions">
          {/* L'Établi, et non la vitrine : d'un groupe dont on est membre, on
              vient ouvrir ce qui s'y passe, pas la page qu'en voient les
              autres. */}
          <Link to={`/social/groups/${group.id}`} className="roll-btn roll-btn--bare">
            {t("social.explore.entry.enter")}
          </Link>
        </div>
      </div>
    </article>
  );
}

function GroupsTab() {
  const { t } = useTranslation();
  const groups = useApi(() => listPlayGroups());
  const games = useApi(() => listGames());
  const gameName = useMemo(() => {
    const map = new Map<string, string>();
    for (const game of games.data ?? []) map.set(game._id, game.name);
    return map;
  }, [games.data]);

  return (
    <>
      {/* `.roll` porte l'or : `--or`, `--or-text` et `--or-faint` n'existent
          que dans ce scope, et sans lui les filets d'une entrée disparaissent
          — une variable indéfinie invalide la déclaration qui la lit. La porte
          y entre aussi : elle emprunte le même filet. */}
      <div className="roll">
        {/* L'onglet ne montre que ses propres groupes ; le rôle d'armes, où
            l'on en découvre d'autres, s'ouvre au-dessus. Sa porte n'est pas
            une entrée — pas d'écu, pas de comptes — mais elle est du même
            écran, et prend donc le filet et la petite capitale du rôle. */}
        <Link to="/social/groups/explore" className="roll-door">
          <SwordsIcon size={17} />
          <span className="roll-door__text">
            <span className="roll-door__title">{t("social.explore.title")}</span>
            <span className="roll-door__sub">{t("social.explore.entrySub")}</span>
          </span>
          <span className="roll-door__go" aria-hidden>
            <ChevronIcon size={16} />
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

        {groups.data?.map((group) => (
          <GroupRollEntry
            key={group.id}
            group={group}
            gameNames={(group.enabledGameIds ?? [])
              .map((id) => gameName.get(id))
              .filter((name): name is string => Boolean(name))}
          />
        ))}
      </div>
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
