import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listSellListItems } from "../api/sell-lists";
import { getUserProfile, getUserPublicWishlists, getUserSellList } from "../api/users";
import type { Wishlist } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import {
  ChevronIcon,
  ExternalLinkIcon,
  HeartIcon,
  LayersIcon,
  LockIcon,
  PinIcon,
  TrophyIcon,
} from "../components/icons";
import { SellListItemRow } from "../components/SellListItemRow";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userLabel } from "../lib/user-tag";

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** N'autorise que http(s) : évite qu'un lien `javascript:` ou un schéma inattendu se retrouve dans un `href`. */
function isSafeUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
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

export function UserProfileScreen() {
  const { t } = useTranslation();
  const { userTag = "" } = useParams();

  const profile = useApi(() => getUserProfile(userTag), [userTag]);
  const wishlists = useApi(() => getUserPublicWishlists(userTag), [userTag]);
  const sellList = useApi(() => getUserSellList(userTag), [userTag]);
  const sellListItems = useApi(
    () =>
      sellList.data
        ? listSellListItems(sellList.data.id)
        : Promise.resolve(null),
    [sellList.data?.id],
  );

  const user = profile.data;
  const label = user ? userLabel(user, t("profile.fallbackTitle")) : "";
  const color = user ? colorFor(user.id) : "#888";
  const links = user
    ? [user.website, ...user.socialLinks].filter(
        (l): l is string => !!l && isSafeUrl(l),
      )
    : [];

  return (
    <div className="screen">
      <BackHeader title={label || t("profile.fallbackTitle")} />
      <StatusView
        loading={profile.loading}
        error={profile.error}
        onRetry={profile.reload}
      />
      {user && (
        <>
          <div className="profile-header">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="avatar avatar--lg" />
            ) : (
              <span className="avatar avatar--lg" style={tintStyle(color)}>
                {initialOf(label || "?")}
              </span>
            )}
            <div className="profile-header__body">
              <h1 className="profile-header__name">
                {label}
                {!user.isPublicProfile && <LockIcon size={16} />}
              </h1>
              {user.description && (
                <p className="profile-header__bio">{user.description}</p>
              )}
              {links.length > 0 && (
                <div className="profile-links">
                  {links.map((link, i) => (
                    <a
                      key={i}
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

          {user.isPublicProfile && (
            <>
              <p className="section-label">{t("profile.gamesTitle")}</p>
              {user.games.length === 0 ? (
                <p className="muted">{t("profile.gamesEmpty")}</p>
              ) : (
                user.games.map((game) => (
                  <div key={game.id} className="list-row">
                    {game.icon ? (
                      <img src={game.icon} alt="" className="list-row__thumb" />
                    ) : (
                      <span
                        className="list-row__icon"
                        style={{ background: "var(--chip)" }}
                      >
                        <LayersIcon size={18} style={{ color: "var(--primary)" }} />
                      </span>
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
                    <span
                      className="list-row__icon"
                      style={{ background: "var(--chip)" }}
                    >
                      <PinIcon size={18} style={{ color: "var(--primary)" }} />
                    </span>
                    <div className="list-row__body">
                      <p className="list-row__title">{lair.name}</p>
                      {lair.address && (
                        <p className="list-row__sub">{lair.address}</p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {user.achievements.length > 0 && (
                <>
                  <p className="section-label">{t("profile.achievementsTitle")}</p>
                  {user.achievements.map((achievement) => (
                    <div key={achievement.id} className="list-row">
                      <span
                        className="list-row__icon"
                        style={{ background: "var(--chip)" }}
                      >
                        <TrophyIcon size={18} style={{ color: "var(--gold)" }} />
                      </span>
                      <div className="list-row__body">
                        <p className="list-row__title">{achievement.name}</p>
                        {achievement.description && (
                          <p className="list-row__sub">
                            {achievement.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {!user.isPublicProfile && (
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("profile.privateNote")}
            </p>
          )}

          {wishlists.data && wishlists.data.length > 0 && (
            <>
              <p className="section-label">{t("profile.wishlistsTitle")}</p>
              {wishlists.data.map((wishlist) => (
                <WishlistRow key={wishlist.id} wishlist={wishlist} />
              ))}
            </>
          )}

          {sellList.data && (
            <>
              <p className="section-label">{t("profile.sellListTitle")}</p>
              <StatusView
                loading={sellListItems.loading}
                error={sellListItems.error}
                onRetry={sellListItems.reload}
                empty={
                  sellListItems.data && sellListItems.data.items.length === 0
                    ? t("sellLists.itemsEmpty")
                    : undefined
                }
              />
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
        </>
      )}
    </div>
  );
}
