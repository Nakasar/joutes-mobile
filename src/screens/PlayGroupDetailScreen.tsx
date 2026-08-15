import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPlayGroupCollectionOverview, recomputeCollectionValue } from "../api/collection";
import { getPlayGroup } from "../api/social";
import { BackHeader } from "../components/BackHeader";
import { CollectionValueCard } from "../components/CollectionValueCard";
import {
  ChevronIcon,
  HeartIcon,
  LockIcon,
  TagIcon,
} from "../components/icons";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { useAuth } from "../store/auth";

function PlayGroupDetailContent({ groupId }: { groupId: string }) {
  const { t } = useTranslation();

  const group = useApi(() => getPlayGroup(groupId), [groupId]);
  const overview = useApi(() => getPlayGroupCollectionOverview(groupId), [groupId]);

  const games = overview.data?.games.filter((game) => game !== null) ?? [];

  return (
    <div className="screen">
      <BackHeader title={group.data?.name ?? t("social.groupDetail.fallbackTitle")} />

      <StatusView
        loading={group.loading}
        error={group.error}
        onRetry={group.reload}
      />

      {group.data && (
        <>
          <Link
            to={`/social/groups/${groupId}/wishlists`}
            className="list-row list-row--link"
          >
            <span
              className="list-row__icon"
              style={{ background: "var(--chip)" }}
            >
              <HeartIcon size={20} style={{ color: "var(--primary)" }} />
            </span>
            <div className="list-row__body">
              <p className="list-row__title">
                {t("social.groupDetail.wishlistsAction")}
              </p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>
          <Link
            to={`/social/groups/${groupId}/sell-list`}
            className="list-row list-row--link"
          >
            <span
              className="list-row__icon"
              style={{ background: "var(--chip)" }}
            >
              <TagIcon size={20} style={{ color: "var(--primary)" }} />
            </span>
            <div className="list-row__body">
              <p className="list-row__title">
                {t("social.groupDetail.sellListAction")}
              </p>
            </div>
            <span className="chevron">
              <ChevronIcon size={18} />
            </span>
          </Link>

          <p className="section-label">
            {t("social.members", { count: group.data.members?.length ?? 0 })}
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
    </div>
  );
}

/** Détail d'un play-group : membres et collection partagée, jeu par jeu. */
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
          <Link to="/login" className="btn btn--grad btn--block">
            {t("common.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return <PlayGroupDetailContent groupId={groupId} />;
}
