import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { explorePlayGroups } from "../api/play-groups";
import type { ExploreGroup, PlayGroupLive } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { ChevronIcon, SearchIcon, UsersIcon } from "../components/icons";
import { StatusView } from "../components/StatusView";
import { EXPLORE_ORDERS, type ExploreOrder } from "../lib/play-group-explore";
import { readPlayGroupAccent } from "../lib/play-group-theme";
import { isSafeUrl } from "../lib/safe-url";

const STEP = 20;
const MAX_COUNT = 100;

/**
 * L'écu d'un groupe : son logo, ou ses initiales sur fond d'accent.
 *
 * L'accent passe par `readPlayGroupAccent` plutôt que d'aller tel quel dans le
 * style : il vient de l'API, et lui seul sait le valider — et calculer le
 * premier plan clair ou sombre que les initiales demandent, un accent ambre ne
 * portant pas du blanc.
 */
function GroupCrest({ group }: { group: ExploreGroup }) {
  if (group.logo) {
    return <CachedImage src={group.logo} alt="" className="group-crest" />;
  }

  const accent = readPlayGroupAccent({
    options: { theme: { accentColor: group.accentColor ?? undefined } },
  });

  return (
    <span className="group-crest group-crest--initials" style={accent.style}>
      {group.initials}
    </span>
  );
}

function LiveStrip({ lives }: { lives: PlayGroupLive[] }) {
  const { t } = useTranslation();
  // Le filtre est posé au rendu et non seulement à l'écriture, comme partout
  // ailleurs : `channelUrl` est reconstruite par le serveur et devrait toujours
  // être en https, mais un `href` ne doit porter que ce qu'on a vérifié.
  const shown = lives.filter((live) => isSafeUrl(live.channelUrl));
  if (shown.length === 0) return null;

  return (
    <>
      <p className="section-label">{t("social.explore.liveNow")}</p>
      <div className="chip-row">
        {shown.map((live) => (
          <a
            key={live.id}
            href={live.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="chip chip--accent"
          >
            <span className="live-dot" />
            {live.title || live.streamer}
          </a>
        ))}
      </div>
    </>
  );
}

/**
 * Le rôle d'armes : découvrir des groupes ouverts.
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

  return (
    <div className="screen">
      <BackHeader title={t("social.explore.title")} />

      <div className="search-field" style={{ marginBottom: 12 }}>
        <SearchIcon size={18} />
        <input
          type="search"
          value={searchInput}
          placeholder={t("social.explore.searchPlaceholder")}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <div className="segmented" style={{ marginBottom: 12 }}>
        {EXPLORE_ORDERS.map((key) => (
          <button
            key={key}
            className={`segmented__item${order === key ? " segmented__item--active" : ""}`}
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

      <LiveStrip lives={lives} />

      {groups.map((group) => (
        <Link
          key={group.id}
          to={`/social/groups/${group.id}/showcase`}
          className="list-row list-row--link"
        >
          <GroupCrest group={group} />
          <div className="list-row__body">
            <p className="list-row__title">
              {group.name}
              {group.lives.length > 0 && (
                <span className="live-dot" aria-label={t("social.explore.live")} />
              )}
            </p>
            <p className="list-row__sub">
              {[group.tagline, group.rhythmLabel, group.place?.label]
                .filter(Boolean)
                .join(" · ") || group.gameNames.join(", ")}
            </p>
          </div>
          <span className="chip">
            <UsersIcon size={13} />
            {group.memberCount}
          </span>
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </Link>
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetry((r) => r + 1)}
        empty={
          !loading && !error && groups.length === 0 ? t("social.explore.empty") : undefined
        }
      />

      {!loading && !error && hasMore && count < MAX_COUNT && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setCount((c) => Math.min(c + STEP, MAX_COUNT))}
        >
          {t("social.explore.loadMore")}
        </button>
      )}
    </div>
  );
}
