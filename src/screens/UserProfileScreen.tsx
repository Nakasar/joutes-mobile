import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchDecks } from "../api/decks";
import { listSellListItems } from "../api/sell-lists";
import {
  getUserAchievements,
  getUserContents,
  getUserProfile,
  getUserPublicWishlists,
  getUserSellList,
} from "../api/users";
import type { PublicUserProfile, Wishlist } from "../api/types";
import { AchievementRow } from "../components/AchievementRow";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { DeckRow } from "../components/DeckRow";
import { FollowButton } from "../components/FollowButton";
import {
  ChevronIcon,
  ExternalLinkIcon,
  HeartIcon,
  LockIcon,
  PinIcon,
  UsersIcon,
} from "../components/icons";
import { SellListItemRow } from "../components/SellListItemRow";
import { StatusView } from "../components/StatusView";
import { UserContentCard } from "../components/UserContentCard";
import { UserMarkdown } from "../components/UserMarkdown";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { isSafeUrl } from "../lib/safe-url";
import {
  readUserProfileTab,
  readUserShowcaseSections,
  sectionsForTab,
  visibleProfileTabs,
  type UserShowcaseSectionKey,
} from "../lib/user-showcase";
import { userLabel } from "../lib/user-tag";
import { useAuth } from "../store/auth";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function WishlistRow({ wishlist }: { wishlist: Wishlist }) {
  const { t } = useTranslation();
  return (
    <Link to={`/wishlists/${wishlist.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <HeartIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{wishlist.name}</p>
        <p className="list-row__sub">
          {t("wishlists.itemsCount", { count: wishlist.itemsCount ?? 0 })}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

/**
 * Le profil d'un joueur, tel qu'il l'a arrangé.
 *
 * La **porte de confidentialité n'est pas une porte d'accès** : un profil privé
 * s'ouvre et répond son pseudonyme, sa description, ses liens et ses badges. Ce
 * sont les jeux suivis, les succès, les publications et le direct qu'il garde —
 * et l'écran le dit, plutôt que de laisser croire à un profil vide.
 *
 * Les blocs suivent l'ordre que le compte a réglé sur le web
 * (`readUserShowcaseSections`), et la barre d'onglets n'est pas une liste fixe :
 * un onglet dont le bloc est éteint, ou dont le bloc n'a rien à montrer,
 * n'existe pas. Une barre à un seul onglet non plus — ce serait du décor.
 */
export function UserProfileScreen() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { userTag = "" } = useParams();

  const [tab, setTab] = useState<string>("showcase");
  const [follow, setFollow] = useState<{ following: boolean; followersCount: number } | null>(
    null,
  );

  // Passer d'un profil à l'autre garde le composant monté, et `useApi` garde la
  // fiche précédente le temps de charger la suivante : sans cette remise à zéro,
  // le second profil hériterait du « je le suis » et du compteur du premier —
  // et les garderait, puisque rien ne les recalcule ensuite.
  useEffect(() => {
    setFollow(null);
    setTab("showcase");
  }, [userTag]);

  const profile = useApi(() => getUserProfile(userTag), [userTag]);
  const user: PublicUserProfile | null = profile.data ?? null;
  const isPublic = Boolean(user?.isPublicProfile);
  const isMe = Boolean(me?.id && user?.id && me.id === user.id);

  // Les blocs d'un profil privé n'ont rien à charger : demander ses decks ou
  // ses publications reviendrait à payer trois requêtes pour trois listes vides.
  const decks = useApi(
    () =>
      user && isPublic
        ? searchDecks({ playerId: user.id, visibility: ["public"], limit: 6 }).then(
            (r) => r.decks,
          )
        : Promise.resolve([]),
    [user?.id, isPublic],
  );
  const contents = useApi(
    () => (user && isPublic ? getUserContents(userTag) : Promise.resolve([])),
    [user?.id, isPublic, userTag],
  );
  const achievements = useApi(
    () =>
      user && isPublic
        ? getUserAchievements(userTag)
        : Promise.resolve({ achievements: [], unlocked: 0, total: 0, points: 0 }),
    [user?.id, isPublic, userTag],
  );
  const wishlists = useApi(() => getUserPublicWishlists(userTag), [userTag]);
  const sellList = useApi(() => getUserSellList(userTag), [userTag]);
  const sellListItems = useApi(
    () => (sellList.data ? listSellListItems(sellList.data.id) : Promise.resolve(null)),
    [sellList.data?.id],
  );

  const sections = useMemo(
    () => (user ? readUserShowcaseSections(user) : []),
    [user],
  );

  const unlocked = (achievements.data?.achievements ?? []).filter((a) => a.unlockedAt);

  // Le bloc « échanges » et son onglet se décident sur la même chose : ce qui
  // s'affiche réellement. Compter sur `sellList.itemsCount` ferait apparaître
  // l'onglet avant que les cartes ne soient là, donc parfois sur du vide.
  const hasTrade =
    (wishlists.data?.length ?? 0) > 0 || (sellListItems.data?.items?.length ?? 0) > 0;

  // Ce que chaque bloc a réellement à montrer : c'est ce qui décide des onglets,
  // et cela ne se sait qu'une fois le contenu chargé.
  const tabs = useMemo(
    () =>
      visibleProfileTabs(sections, {
        live: Boolean(user?.live),
        about: Boolean(user?.description) || (user?.showcase?.playStyles?.length ?? 0) > 0,
        decks: (decks.data?.length ?? 0) > 0,
        publications: (contents.data?.length ?? 0) > 0,
        achievements: unlocked.length > 0,
        follows: true,
        trade: hasTrade,
      }),
    [sections, user, decks.data, contents.data, unlocked.length, hasTrade],
  );

  const current = readUserProfileTab(tab, tabs);
  const shown = sectionsForTab(sections, current);

  const label = user ? userLabel(user, t("profile.fallbackTitle")) : "";
  const links = user
    ? [user.website, ...user.socialLinks].filter((l): l is string => !!l && isSafeUrl(l))
    : [];
  const followersCount = follow?.followersCount ?? user?.followersCount ?? 0;
  const following = follow?.following ?? user?.isFollowing ?? false;

  function block(key: UserShowcaseSectionKey) {
    switch (key) {
      case "live":
        return user?.live && isSafeUrl(user.live.url) ? (
          <a
            key={key}
            href={user.live.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card profile-live"
          >
            <span className="live-dot" />
            <div>
              <p className="list-row__title">{user.live.title || t("profile.live.title")}</p>
              <p className="list-row__sub">{t("profile.live.watch")}</p>
            </div>
            <ExternalLinkIcon size={16} />
          </a>
        ) : null;

      case "about":
        return user?.description || (user?.showcase?.playStyles?.length ?? 0) > 0 ? (
          <section key={key} className="card">
            {user?.description && <UserMarkdown>{user.description}</UserMarkdown>}
            {(user?.showcase?.playStyles?.length ?? 0) > 0 && (
              <div className="chip-row" style={{ marginTop: 8, marginBottom: 0 }}>
                {user?.showcase?.playStyles?.map((style) => (
                  <span key={style} className="chip">
                    {style}
                  </span>
                ))}
              </div>
            )}
          </section>
        ) : null;

      case "decks":
        return (decks.data?.length ?? 0) > 0 ? (
          <section key={key}>
            <p className="section-label">{t("profile.decksTitle")}</p>
            {decks.data?.map((deck) => (
              <DeckRow key={deck.id} deck={deck} />
            ))}
          </section>
        ) : null;

      case "publications":
        return (contents.data?.length ?? 0) > 0 ? (
          <section key={key}>
            <p className="section-label">{t("profile.publications.title")}</p>
            {contents.data?.map((content) => (
              <UserContentCard key={content.id} content={content} userTag={userTag} />
            ))}
          </section>
        ) : null;

      case "achievements":
        return unlocked.length > 0 ? (
          <section key={key}>
            <p className="section-label">
              {t("profile.achievements.title")}
              {achievements.data
                ? ` · ${t("profile.achievements.progress", {
                    unlocked: achievements.data.unlocked,
                    total: achievements.data.total,
                  })}`
                : ""}
            </p>
            {/* L'onglet dédié montre le catalogue entier, celui qui reste à
                atteindre compris ; la vitrine s'en tient aux trois derniers. */}
            {(current === "achievements"
              ? achievements.data?.achievements ?? []
              : unlocked.slice(0, 3)
            ).map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} />
            ))}
          </section>
        ) : null;

      case "follows":
        return isPublic && (user?.games.length || user?.lairs.length) ? (
          <section key={key}>
            <p className="section-label">{t("profile.gamesTitle")}</p>
            {user.games.length === 0 ? (
              <p className="muted">{t("profile.gamesEmpty")}</p>
            ) : (
              user.games.map((game) => (
                <div key={game.id} className="list-row">
                  {game.icon && (
                    <CachedImage src={game.icon} alt="" className="list-row__thumb" />
                  )}
                  <div className="list-row__body">
                    <p className="list-row__title">{game.name}</p>
                  </div>
                </div>
              ))
            )}
            <p className="section-label">{t("profile.lairsTitle")}</p>
            {user.lairs.length === 0 ? (
              <p className="muted">{t("profile.lairsEmpty")}</p>
            ) : (
              user.lairs.map((lair) => (
                <div key={lair.id} className="list-row">
                  <span className="list-row__icon" style={{ background: "var(--chip)" }}>
                    <PinIcon size={18} style={{ color: "var(--primary)" }} />
                  </span>
                  <div className="list-row__body">
                    <p className="list-row__title">{lair.name}</p>
                    {lair.address && <p className="list-row__sub">{lair.address}</p>}
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null;

      case "trade":
        return hasTrade ? (
          <section key={key}>
            {(wishlists.data?.length ?? 0) > 0 && (
              <>
                <p className="section-label">{t("profile.wishlistsTitle")}</p>
                {wishlists.data?.map((wishlist) => (
                  <WishlistRow key={wishlist.id} wishlist={wishlist} />
                ))}
              </>
            )}
            {(sellListItems.data?.items?.length ?? 0) > 0 && (
              <>
                <p className="section-label">{t("profile.sellListTitle")}</p>
                {sellListItems.data?.items.map((item) => (
                  <SellListItemRow
                    key={item.id}
                    item={item}
                    canEdit={false}
                    onChanged={() => {}}
                  />
                ))}
              </>
            )}
          </section>
        ) : null;
    }
  }

  return (
    <div className="screen">
      <BackHeader
        title={label || t("profile.fallbackTitle")}
        action={
          user && !isMe ? (
            <FollowButton
              userTagOrId={userTag}
              userId={user.id}
              following={following}
              followersCount={followersCount}
              onChange={setFollow}
            />
          ) : undefined
        }
      />
      <StatusView loading={profile.loading} error={profile.error} onRetry={profile.reload} />

      {user && (
        <>
          {user.banner && (
            <CachedImage src={user.banner} alt="" className="profile-hero__banner" />
          )}

          <div className="profile-header">
            {user.avatar ? (
              <CachedImage src={user.avatar} alt="" className="avatar avatar--lg" />
            ) : (
              <span className="avatar avatar--lg" style={tintStyle(colorFor(user.id))}>
                {initialOf(label || "?")}
              </span>
            )}
            <div className="profile-header__body">
              <h1 className="profile-header__name">
                {label}
                {!isPublic && <LockIcon size={16} />}
              </h1>
              <div className="chip-row profile-badges">
                <span className="chip">
                  <UsersIcon size={13} />
                  {t("profile.followers", { count: followersCount })}
                </span>
                {user.badges?.statuses?.map((status) => (
                  <span key={status.id} className="chip chip--accent">
                    {status.name}
                  </span>
                ))}
              </div>
              {links.length > 0 && (
                <div className="profile-links">
                  {links.map((link, index) => (
                    <a
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="header-link"
                    >
                      <ExternalLinkIcon size={13} />
                      {hostnameOf(link)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {tabs.length > 0 && (
            <div className="segmented" style={{ margin: "12px 0" }}>
              {tabs.map((key) => (
                <button
                  key={key}
                  className={`segmented__item${current === key ? " segmented__item--active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {t(`profile.tabs.${key}`)}
                </button>
              ))}
            </div>
          )}

          {shown.map((key) => block(key))}

          {!isPublic && <p className="status muted">{t("profile.privateNote")}</p>}
        </>
      )}
    </div>
  );
}
