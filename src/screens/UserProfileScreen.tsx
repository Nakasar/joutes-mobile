import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDeckCards, searchDecks } from "../api/decks";
import { listLairs } from "../api/lairs";
import { listSellListItems } from "../api/sell-lists";
import {
  getUserAchievements,
  getUserContents,
  getUserProfile,
  getUserPublicWishlists,
  getUserSellList,
} from "../api/users";
import type { Deck, Lair, PublicUserLair, PublicUserProfile, Wishlist } from "../api/types";
import { AchievementRow } from "../components/AchievementRow";
import { CachedImage } from "../components/CachedImage";
import { DeckCard } from "../components/DeckCard";
import { FollowButton } from "../components/FollowButton";
import { LairCard } from "../components/LairCard";
import { Movement } from "../components/Movement";
import { Tabs } from "../components/Tabs";
import {
  BackIcon,
  ChevronIcon,
  ExternalLinkIcon,
  HeartIcon,
  LockIcon,
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
  const navigate = useNavigate();
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
  // La bande de chiffres annonce **tous** les decks publics, la liste n'en
  // montre que les premiers : compter les fiches chargées afficherait « 6 » à
  // qui en a publié vingt.
  const decks = useApi(
    () =>
      user && isPublic
        ? searchDecks({ playerId: user.id, visibility: ["public"], limit: 6 }).then((r) => ({
            list: r.decks,
            total: r.total,
          }))
        : Promise.resolve({ list: [], total: 0 }),
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
  /**
   * Le profil ne sert d'un lieu suivi que son id, son nom et son adresse — ni
   * bannière, ni logo, ni horaires. L'annuaire, lui, les porte : on le charge
   * une fois (il est déjà en cache pour l'onglet Communauté) et on rapproche
   * par id. Un lieu absent de cette trentaine garde sa fiche minimale, que
   * `LairCard` sait afficher — carré d'initiales, pas de bannière, pas de cri.
   */
  const directory = useApi(() => (isPublic ? listLairs() : Promise.resolve(null)), [isPublic]);
  const lairById = useMemo(() => {
    const map = new Map<string, Lair>();
    for (const lair of directory.data?.lairs ?? []) map.set(lair.id, lair);
    return map;
  }, [directory.data]);
  const fullLair = (lair: PublicUserLair): Lair => lairById.get(lair.id) ?? lair;

  const wishlists = useApi(() => getUserPublicWishlists(userTag), [userTag]);
  const sellList = useApi(() => getUserSellList(userTag), [userTag]);
  const sellListItems = useApi(
    () => (sellList.data ? listSellListItems(sellList.data.id) : Promise.resolve(null)),
    [sellList.data?.id],
  );

  /**
   * L'illustration de légende de chaque deck.
   *
   * Le web l'obtient en interprétant la liste de cartes en texte libre ; ici
   * `legendCardId` la désigne directement. Les identifiants sont **groupés par
   * jeu** : `getDeckCards` en accepte cinq cents d'un coup, donc six decks du
   * même jeu coûtent une requête, pas six. Un jeu injoignable rend une liste
   * vide plutôt que de faire échouer les autres — un deck sans illustration
   * garde sa fiche.
   */
  const legendArt = useApi(async () => {
    const byGame = new Map<string, string[]>();
    for (const deck of decks.data?.list ?? []) {
      if (!deck.gameId || !deck.legendCardId) continue;
      const ids = byGame.get(deck.gameId) ?? [];
      ids.push(deck.legendCardId);
      byGame.set(deck.gameId, ids);
    }
    if (byGame.size === 0) return {} as Record<string, string>;

    const perGame = await Promise.all(
      Array.from(byGame, ([gameId, ids]) => getDeckCards(gameId, ids).catch(() => [])),
    );

    const art: Record<string, string> = {};
    for (const card of perGame.flat()) {
      if (card.image) art[card.id] = card.image;
    }
    return art;
  }, [decks.data?.list]);

  /** Le nom d'un jeu se lit sur le profil : pas de requête de plus pour ça. */
  const gameNames = useMemo(
    () => new Map((user?.games ?? []).map((game) => [game.id, game.name])),
    [user?.games],
  );

  function deckCard(deck: Deck) {
    return (
      <DeckCard
        key={deck.id}
        deck={deck}
        legendImage={deck.legendCardId ? legendArt.data?.[deck.legendCardId] : undefined}
        gameName={deck.gameId ? gameNames.get(deck.gameId) : undefined}
      />
    );
  }

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
        decks: (decks.data?.list.length ?? 0) > 0,
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
  // `userLabel` rend « Pseudo#1234 » : le discriminant passe en retrait, il sert
  // à départager deux homonymes, pas à les nommer.
  const hash = label.lastIndexOf("#");
  const name = hash > 0 ? label.slice(0, hash) : label;
  const tag = hash > 0 ? label.slice(hash) : "";
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
        return (decks.data?.list.length ?? 0) > 0 ? (
          <section key={key}>
            <Movement section title={t("profile.decksTitle")} />
            {/* La vitrine met un deck en avant — celui-là occupe déjà la
                hauteur d'une illustration ; l'onglet dédié les montre tous. */}
            {(current === "decks"
              ? decks.data?.list ?? []
              : (decks.data?.list ?? []).slice(0, 1)
            ).map(deckCard)}
          </section>
        ) : null;

      case "publications":
        return (contents.data?.length ?? 0) > 0 ? (
          <section key={key}>
            <Movement section title={t("profile.publications.title")} />
            {contents.data?.map((content) => (
              <UserContentCard key={content.id} content={content} userTag={userTag} />
            ))}
          </section>
        ) : null;

      case "achievements":
        return unlocked.length > 0 ? (
          <section key={key}>
            <Movement
              section
              title={t("profile.achievements.title")}
              aside={
                achievements.data
                  ? t("profile.achievements.progress", {
                      unlocked: achievements.data.unlocked,
                      total: achievements.data.total,
                    })
                  : undefined
              }
            />
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
            {/* Ce qu'on suit se visite : chaque jeu et chaque lieu ouvre sa
                page. Les lignes mortes d'avant donnaient une liste qu'on
                lisait sans pouvoir la suivre. */}
            <Movement section title={t("profile.gamesTitle")} />
            {user.games.length === 0 ? (
              <p className="muted">{t("profile.gamesEmpty")}</p>
            ) : (
              <div className="follow-grid">
                {user.games.map((game) => (
                  <Link
                    key={game.id}
                    to={`/games/${game.slug ?? game.id}`}
                    className="follow-tile"
                  >
                    {game.icon ? (
                      <CachedImage
                        src={game.icon}
                        alt=""
                        className="avatar avatar--game follow-tile__icon"
                        fallback={
                          <span
                            className="avatar avatar--game follow-tile__icon"
                            style={tintStyle(colorFor(game.id))}
                          >
                            {initialOf(game.name)}
                          </span>
                        }
                      />
                    ) : (
                      <span
                        className="avatar avatar--game follow-tile__icon"
                        style={tintStyle(colorFor(game.id))}
                      >
                        {initialOf(game.name)}
                      </span>
                    )}
                    <span className="follow-tile__name">{game.name}</span>
                  </Link>
                ))}
              </div>
            )}

            <Movement section title={t("profile.lairsTitle")} />
            {user.lairs.length === 0 ? (
              <p className="muted">{t("profile.lairsEmpty")}</p>
            ) : (
              user.lairs.map((lair) => <LairCard key={lair.id} lair={fullLair(lair)} />)
            )}
          </section>
        ) : null;

      case "trade":
        return hasTrade ? (
          <section key={key}>
            {(wishlists.data?.length ?? 0) > 0 && (
              <>
                <Movement section title={t("profile.wishlistsTitle")} />
                {wishlists.data?.map((wishlist) => (
                  <WishlistRow key={wishlist.id} wishlist={wishlist} />
                ))}
              </>
            )}
            {(sellListItems.data?.items?.length ?? 0) > 0 && (
              <>
                <Movement section title={t("profile.sellListTitle")} />
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
      <StatusView loading={profile.loading} error={profile.error} onRetry={profile.reload} />

      {user && (
        <>
          {/*
           * La bannière touche les bords de l'écran, zone de sécurité comprise,
           * et porte le retour et le bouton « Suivre » en verre. C'est ce qui
           * permet de n'écrire le pseudonyme **qu'une fois** : l'en-tête de
           * retour le répétait au-dessus d'une bannière qui, elle, flottait
           * dans la gouttière.
           */}
          <div className="hero-bleed">
            {user.banner ? (
              <CachedImage src={user.banner} alt="" className="hero-bleed__media" />
            ) : (
              <div className="hero-bleed__media" />
            )}
            <div className="hero-bleed__scrim" />
            <div className="hero-bleed__float">
              <button
                className="glass-btn glass-btn--icon"
                onClick={() => navigate(-1)}
                aria-label={t("common.back")}
              >
                <BackIcon size={20} />
              </button>
              {!isMe && (
                <FollowButton
                  variant="glass"
                  userTagOrId={userTag}
                  userId={user.id}
                  following={following}
                  followersCount={followersCount}
                  onChange={setFollow}
                />
              )}
            </div>
          </div>

          <div className="profile-id">
            {user.avatar ? (
              <CachedImage src={user.avatar} alt="" className="avatar avatar--lg" />
            ) : (
              <span className="avatar avatar--lg" style={tintStyle(colorFor(user.id))}>
                {initialOf(label || "?")}
              </span>
            )}
            <div className="profile-id__body">
              <h1 className="profile-id__name">
                <span className="profile-id__handle">
                  {name}
                  {tag && <span className="profile-id__tag">{tag}</span>}
                </span>
                {!isPublic && <LockIcon size={16} />}
              </h1>
            </div>
          </div>

          {(user.badges?.statuses?.length ?? 0) > 0 && (
            <div className="chip-row profile-badges">
              {user.badges?.statuses?.map((status) => (
                <span key={status.id} className="chip chip--accent">
                  {status.name}
                </span>
              ))}
            </div>
          )}

          {/*
           * Trois chiffres que le profil possède déjà, à la place de la seule
           * pastille « n abonnés » : c'est ce qu'on vient vérifier chez
           * quelqu'un. Un profil privé n'a ni succès ni decks publics — la
           * bande n'aurait qu'une case, et une case ne fait pas un tableau :
           * le compteur d'abonnés y reprend sa pastille.
           */}
          {isPublic ? (
            <div className="profile-stats">
              <div className="profile-stats__cell">
                <span className="profile-stats__value">{followersCount}</span>
                <span className="profile-stats__label">{t("profile.stats.followers")}</span>
              </div>
              <div className="profile-stats__cell">
                <span className="profile-stats__value">
                  {achievements.data?.unlocked ?? 0}
                  <span className="profile-stats__of"> / {achievements.data?.total ?? 0}</span>
                </span>
                <span className="profile-stats__label">{t("profile.stats.achievements")}</span>
              </div>
              <div className="profile-stats__cell">
                <span className="profile-stats__value">{decks.data?.total ?? 0}</span>
                <span className="profile-stats__label">{t("profile.stats.decks")}</span>
              </div>
            </div>
          ) : (
            <div className="chip-row profile-badges">
              <span className="chip">
                <UsersIcon size={13} />
                {t("profile.followers", { count: followersCount })}
              </span>
            </div>
          )}

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

          {/* Cinq onglets ne tiennent pas côte à côte sur un téléphone étroit :
              la barre défile. Sans cela le dernier — « Échanges » — sort de
              l'écran. */}
          {tabs.length > 0 && (
            <Tabs
              className="profile-tabs"
              current={current}
              onSelect={setTab}
              items={tabs.map((key) => ({ key, label: t(`profile.tabs.${key}`) }))}
            />
          )}

          {shown.map((key) => block(key))}

          {!isPublic && <p className="status muted">{t("profile.privateNote")}</p>}
        </>
      )}
    </div>
  );
}
