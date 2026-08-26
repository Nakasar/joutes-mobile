import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { explorePlayGroups, setFollowingPlayGroup } from "../api/play-groups";
import type { ExploreGroup, PlayGroupLive } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { GroupEscu } from "../components/GroupEscu";
import { ClockIcon, EyeOffIcon, PinIcon, RepeatIcon, SearchIcon } from "../components/icons";
import { Movement } from "../components/Movement";
import { StatusView } from "../components/StatusView";
import { EXPLORE_ORDERS, type ExploreOrder } from "../lib/play-group-explore";
import { readPlayGroupAccent } from "../lib/play-group-theme";
import { isSafeUrl } from "../lib/safe-url";
import { formatDeadline } from "../lib/tournament-deadline";
import { useAuth } from "../store/auth";

const STEP = 20;
const MAX_COUNT = 100;

/** Le filet à losange qui ferme le rôle. */
function Fleuron() {
  return (
    <div className="fleuron" aria-hidden>
      <i />
    </div>
  );
}

/**
 * En lice : qui diffuse en ce moment.
 *
 * Le web déroule ici de vraies vignettes de flux ; à cette largeur elles
 * mangeraient l'écran avant qu'on ait vu un seul groupe. La bande reste donc
 * une bande — mais dans l'or du rôle, et non dans la pastille teal du reste de
 * l'application, qui jurerait au milieu de l'héraldique.
 *
 * L'écu ne peut pas l'accompagner : `PlayGroupLive` ne porte pas l'identifiant
 * de son groupe, seulement le flux.
 */
function LiveWall({ lives }: { lives: PlayGroupLive[] }) {
  const { t } = useTranslation();
  // Le filtre est posé au rendu et non seulement à l'écriture, comme partout
  // ailleurs : `channelUrl` est reconstruite par le serveur et devrait toujours
  // être en https, mais un `href` ne doit porter que ce qu'on a vérifié.
  const shown = lives.filter((live) => isSafeUrl(live.channelUrl));
  if (shown.length === 0) return null;

  return (
    <section>
      <Movement
        title={t("social.explore.liveNow")}
        aside={t("social.explore.liveCount", { count: shown.length })}
      />

      <div className="roll-lives">
        {shown.map((live) => (
          <a
            key={live.id}
            href={live.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="roll-live"
          >
            <span className="live-dot" aria-hidden />
            <span className="roll-live__title">{live.title || live.streamer}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * Une entrée du rôle.
 *
 * Portage de `RollEntry` (`app/[locale]/(app)/play-groups/explore/ExploreRoll.tsx`)
 * de joutes-app : l'écu, le nom en héraldique, le cri, les comptes, l'action.
 *
 * Le **cri** est ce que le groupe a fait de plus récent — un direct, sinon un
 * fait d'armes daté, sinon l'aveu qu'il n'a rien fait. C'est lui qui donne son
 * sens au classement : le rôle range du plus vif au plus endormi, et chaque
 * ligne dit pourquoi elle est là.
 */
function RollEntry({
  group,
  following,
  followerCount,
  onFollow,
  busy,
}: {
  group: ExploreGroup;
  following: boolean;
  /** Le compte à afficher : celui de l'API, ou celui que le suivi vient de bouger. */
  followerCount: number;
  onFollow: (next: boolean) => void;
  busy: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();

  const accent = readPlayGroupAccent({
    options: { theme: { accentColor: group.accentColor ?? undefined } },
  });

  const live = group.lives[0];
  const deed = group.lastDeed;

  // Le compteur de spectateurs n'est renseigné nulle part aujourd'hui : sans
  // lui, on dit qui diffuse, plutôt que « 0 spectateurs ».
  const cry = live
    ? typeof live.viewers === "number"
      ? t("social.explore.entry.liveCry", { streamer: live.streamer, count: live.viewers })
      : t("social.explore.entry.liveCryPlain", { streamer: live.streamer })
    : deed
      ? t(`social.explore.entry.deeds.${deed.kind}`, {
          at: formatDeadline(deed.at, i18n.language),
          title: deed.label ?? "",
        })
      : t("social.explore.entry.quiet");

  return (
    <article className="roll-entry play-group-theme" style={accent.style}>
      <GroupEscu
        initials={group.initials}
        logo={group.logo}
        accentColor={group.accentColor}
        live={!!live}
        liveLabel={t("social.explore.live")}
        size="lg"
      />

      <div className="roll-entry__body">
        <h3 className="roll-entry__name">
          <Link to={`/social/groups/${group.id}/showcase`}>{group.name}</Link>

          {/* Seul un membre voit cette ligne : le sceau lui dit que ce
              groupe-là n'apparaît au rôle de personne d'autre. */}
          {group.visibility === "private" && (
            <span className="roll-entry__seal">
              <EyeOffIcon size={11} />
              {t("social.explore.private")}
            </span>
          )}
        </h3>

        {group.tagline && <p className="roll-entry__tagline">{group.tagline}</p>}

        <p
          className={`roll-entry__cry${live ? " roll-entry__cry--live" : deed ? "" : " roll-entry__cry--quiet"}`}
        >
          {live ? (
            <span className="live-dot" aria-hidden />
          ) : (
            !deed && <ClockIcon size={14} />
          )}
          {cry}
        </p>

        {(group.rhythmLabel || group.place?.label) && (
          <div className="roll-entry__meta">
            {group.rhythmLabel && (
              <span>
                <RepeatIcon size={13} />
                {group.rhythmLabel}
              </span>
            )}
            {group.place?.label && (
              <span>
                <PinIcon size={13} />
                {group.place.label}
              </span>
            )}
          </div>
        )}

        {group.gameNames.length > 0 && (
          <p className="roll-entry__games">{group.gameNames.slice(0, 3).join(" · ")}</p>
        )}
      </div>

      <div className="roll-entry__foot">
        <div className="roll-entry__tally">
          <span>
            <b>{group.memberCount}</b>
            {t("social.explore.entry.members", { count: group.memberCount })}
          </span>
          <span>
            <b>{followerCount}</b>
            {t("social.explore.entry.followers", { count: followerCount })}
          </span>
          <span>
            <b>{group.publishedCount}</b>
            {t("social.explore.entry.published", { count: group.publishedCount })}
          </span>
        </div>

        <div className="roll-entry__actions">
          {isAuthenticated && (
            <button
              className={`roll-btn${following ? " roll-btn--on" : ""}`}
              disabled={busy}
              aria-pressed={following}
              onClick={() => onFollow(!following)}
            >
              {following
                ? t("social.explore.entry.following")
                : t("social.explore.entry.follow")}
            </button>
          )}

          <Link to={`/social/groups/${group.id}/showcase`} className="roll-btn roll-btn--bare">
            {t("social.explore.entry.enter")}
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Le rôle d'armes : découvrir des groupes ouverts.
 *
 * L'écran reprend l'héraldique du web — l'écu plutôt que la vignette, le filet
 * d'or plutôt que la carte, la petite capitale plutôt que la pastille. Ce n'est
 * pas de l'ornement : le rôle est la seule page de Joutes qui range des groupes
 * par vivacité, et sa forme le dit avant que le premier cri ne se lise.
 *
 * Le classement est fait par le serveur — un direct passe devant tout, puis une
 * publication récente ou une session à venir. L'écran n'a qu'à demander l'ordre
 * et l'afficher.
 *
 * **« Proches » demande une position, que l'application ne sait pas lire** :
 * elle exigerait une permission native non déclarée. L'ordre reste proposé mais
 * dit pourquoi il ne trie pas — le masquer laisserait croire qu'il n'existe pas,
 * alors qu'il fonctionne sur le web.
 */
export function PlayGroupsExploreScreen() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<ExploreOrder>("vifs");
  const [count, setCount] = useState(STEP);
  const [retry, setRetry] = useState(0);

  const [groups, setGroups] = useState<ExploreGroup[]>([]);
  const [lives, setLives] = useState<PlayGroupLive[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Les suivis basculés ici, par-dessus ce que l'API a rendu.
   *
   * Un recalque local plutôt qu'une réécriture de `groups` : la liste est
   * remplacée à chaque requête, et un suivi posé juste avant un « charger
   * plus » se perdrait dans le remplacement.
   *
   * Le compte d'abonnés voyage avec l'état : le rôle l'affiche juste à côté du
   * bouton, et le laisser figé à 23 après avoir touché « Suivre » donnerait
   * l'impression que rien n'est parti.
   */
  const [follows, setFollows] = useState<
    Record<string, { following: boolean; followerCount: number }>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCount(STEP);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    explorePlayGroups({ q: search || undefined, order, count })
      .then((data) => {
        if (id !== requestId.current) return;
        // Chaque appel rend la liste depuis le début : on remplace.
        setGroups(data.groups);
        setLives(data.lives);
        setHasMore(data.hasMore);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("common.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [search, order, count, retry, t]);

  async function toggleFollow(
    group: ExploreGroup,
    next: boolean,
    followerCount: number,
  ) {
    const before = { following: !next, followerCount };
    // Optimiste : suivre un groupe n'engage que celui qui touche, et le faire
    // attendre un aller-retour donnerait l'impression d'un bouton mort. Même
    // règle que sur la vitrine.
    setFollows((current) => ({
      ...current,
      [group.id]: { following: next, followerCount: followerCount + (next ? 1 : -1) },
    }));
    setBusyId(group.id);

    try {
      const result = await setFollowingPlayGroup(group.id, next);
      setFollows((current) => ({ ...current, [group.id]: result }));
    } catch {
      setFollows((current) => ({ ...current, [group.id]: before }));
    } finally {
      setBusyId(null);
    }
  }

  const showRoll = !loading && !error && groups.length > 0;

  return (
    <div className="screen roll">
      <BackHeader title={t("social.explore.title")} />

      <label className="roll-search">
        <SearchIcon size={17} />
        <input
          type="search"
          value={searchInput}
          placeholder={t("social.explore.searchPlaceholder")}
          aria-label={t("social.explore.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </label>

      <div className="roll-orders">
        {EXPLORE_ORDERS.map((key) => (
          <button
            key={key}
            aria-pressed={order === key}
            onClick={() => {
              setOrder(key);
              setCount(STEP);
            }}
          >
            {t(`social.explore.order.${key}`)}
          </button>
        ))}
      </div>

      {order === "proches" && (
        <p className="status muted">{t("social.explore.nearUnavailable")}</p>
      )}

      {/* Une recherche en cours efface la bande des directs : on cherche un
          groupe, on ne veut pas dérouler une vitrine avant d'atteindre le
          rôle. La même règle que sur le web. */}
      {!search && <LiveWall lives={lives} />}

      <Movement
        title={search ? t("social.explore.roll.results") : t("social.explore.roll.title")}
        aside={showRoll ? t("social.explore.roll.count", { count: groups.length }) : undefined}
      />

      {showRoll && <p className="roll__notice">{t(`social.explore.notice.${order}`)}</p>}

      {groups.map((group) => {
        const state = follows[group.id];
        const following = state?.following ?? group.isFollowing ?? false;
        const followerCount = state?.followerCount ?? group.followerCount;

        return (
          <RollEntry
            key={group.id}
            group={group}
            following={following}
            followerCount={followerCount}
            busy={busyId === group.id}
            onFollow={(next) => toggleFollow(group, next, followerCount)}
          />
        );
      })}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetry((r) => r + 1)}
        empty={
          !loading && !error && groups.length === 0 ? t("social.explore.empty") : undefined
        }
      />

      {!loading && !error && groups.length === 0 && search && (
        <button className="roll-btn" onClick={() => setSearchInput("")}>
          {t("social.explore.roll.reset")}
        </button>
      )}

      {!loading && !error && hasMore && count < MAX_COUNT && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setCount((c) => Math.min(c + STEP, MAX_COUNT))}
        >
          {t("social.explore.loadMore")}
        </button>
      )}

      {showRoll && !hasMore && <Fleuron />}
    </div>
  );
}
