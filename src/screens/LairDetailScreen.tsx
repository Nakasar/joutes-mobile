import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listEvents } from "../api/events";
import { getLair, setFollowingLair } from "../api/lairs";
import { listGames } from "../api/games";
import { getMyFollowedGameIds } from "../api/users";
import type { JoutesEvent, LairNewsItem } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { LairAgenda } from "../components/LairAgenda";
import { LairFeaturedEvent } from "../components/LairFeaturedEvent";
import { LairHours } from "../components/LairHours";
import { LairNewsCard } from "../components/LairNewsCard";
import { LairPracticalInfo, directionsUrl } from "../components/LairPracticalInfo";
import { LairUpcomingEvents } from "../components/LairUpcomingEvents";
import { Movement } from "../components/Movement";
import { StatusView } from "../components/StatusView";
import { Tabs } from "../components/Tabs";
import { UserMarkdown } from "../components/UserMarkdown";
import {
  CalendarIcon,
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  PinIcon,
  UsersIcon,
} from "../components/icons";
import { useApi } from "../hooks/useApi";
import { useSavedPlace } from "../hooks/useSavedPlace";
import { useSearchParamState } from "../hooks/useSearchParamState";
import { currentLocale } from "../i18n";
import { colorFor, initialsOf, tintStyle } from "../lib/game-visuals";
import { readOpeningState } from "../lib/lair-hours";
import { isSectionEnabled, readLairSections } from "../lib/lair-sections";
import { readLairAccent } from "../lib/lair-theme";
import { externalUrl } from "../lib/lair-urls";
import { useAuth } from "../store/auth";

const TABS = ["news", "agenda", "games", "about"] as const;
type Tab = (typeof TABS)[number];

/** Les annonces, l'épinglée en tête puis les autres de la plus récente. */
function orderedNews(news: LairNewsItem[] | undefined): LairNewsItem[] {
  return [...(news ?? [])].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
}

/** Les événements encore à venir, du plus proche au plus lointain. */
function upcomingOf(events: JoutesEvent[]): JoutesEvent[] {
  const now = new Date();
  return events
    .filter((event) => new Date(event.endDateTime || event.startDateTime) >= now)
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

/**
 * La vitrine d'un lieu, sur le modèle de celle du site.
 *
 * Le hero dit l'identité et l'état du moment — ouvert, fermé, jusqu'à quand.
 * Puis quatre onglets : **actualités** (le direct d'abord, puis les blocs dans
 * l'ordre réglé par le lieu, les prochains événements, les informations
 * pratiques), **agenda** (mes inscriptions, puis le calendrier dans le mode
 * du lieu, puis son rythme), **jeux** (les vignettes, avec le nombre
 * d'événements à venir sur chacun) et **à propos**.
 *
 * **Un lieu privé hors de portée rend 404**, et l'écran affiche l'erreur telle
 * quelle : il ne peut pas dire « ce lieu est privé » sans confirmer qu'il
 * existe, ce que sa confidentialité lui promet de taire.
 *
 * La marque blanche s'arrête à l'accent — titres, pastilles, bouton « Suivre ».
 * `tintSurfaces`, qui teinte les cartes sur le web, n'est pas appliqué : pensé
 * sur fond clair, il écrase les surfaces du fond sombre du mobile.
 */
export function LairDetailScreen() {
  const { t } = useTranslation();
  const { lairId = "" } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { place } = useSavedPlace();
  const locale = currentLocale();

  const [tab, setTab] = useSearchParamState<Tab>("tab", TABS, "news");
  const [follow, setFollow] = useState<{
    following: boolean;
    followersCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Changer de lieu garde le composant monté : sans remise à zéro, le suivant
  // hériterait du « je le suis » et du compteur du précédent. L'onglet, lui,
  // vit dans l'URL : un autre lieu est une autre URL.
  useEffect(() => {
    setFollow(null);
  }, [lairId]);

  const lair = useApi(() => getLair(lairId), [lairId]);
  const data = lair.data ?? null;

  const games = useApi(() => listGames(), []);
  const myGameIds = useApi(
    () => (isAuthenticated ? getMyFollowedGameIds() : Promise.resolve([])),
    [isAuthenticated],
  );
  const events = useApi(
    () =>
      data
        ? listEvents({ lairId, year: new Date().getFullYear(), gameId: "all" })
        : Promise.resolve([]),
    [data?.id, lairId],
  );

  const sections = useMemo(() => (data ? readLairSections(data) : []), [data]);
  const accent = useMemo(() => (data ? readLairAccent(data) : { color: null, style: {} }), [data]);
  const opening = useMemo(
    () => readOpeningState(data?.options?.openingHours, locale),
    [data?.options?.openingHours, locale],
  );

  const following = follow?.following ?? data?.isFollowing ?? false;
  const followersCount = follow?.followersCount ?? data?.followersCount ?? 0;

  // La section « à propos » éteinte n'a plus de contenu du tout — ni sa
  // présentation, ni ses équipements, ni son équipe.
  const about = isSectionEnabled(sections, "about") ? data?.options?.about : undefined;

  const news = orderedNews(data?.options?.news);
  const live = externalUrl(data?.options?.live?.url);
  const website = externalUrl(data?.website);
  const links = (data?.options?.links ?? []).flatMap((link) => {
    const url = externalUrl(link.url);
    return url ? [{ ...link, url }] : [];
  });

  const upcoming = useMemo(() => upcomingOf(events.data ?? []), [events.data]);
  const featured = data?.options?.featuredEventId
    ? upcoming.find((event) => event.id === data.options?.featuredEventId)
    : undefined;

  /** Les jeux du lieu, dans l'ordre déclaré, les inconnus retirés. */
  const lairGames = (data?.games ?? []).flatMap((id) => {
    const game = (games.data ?? []).find((entry) => entry._id === id);
    return game ? [game] : [];
  });
  /** Les jeux du lieu que le visiteur suit — par nom, la clé des événements. */
  const followedGameNames = lairGames
    .filter((game) => (myGameIds.data ?? []).includes(game._id))
    .map((game) => game.name);
  /** Combien d'événements à venir portent chaque jeu, par nom. */
  const upcomingByGame = useMemo(
    () =>
      upcoming.reduce<Record<string, number>>((counts, event) => {
        const name = event.gameName ?? event.game?.name;
        if (name) counts[name] = (counts[name] ?? 0) + 1;
        return counts;
      }, {}),
    [upcoming],
  );
  const registrations = user?.id
    ? upcoming.filter((event) => event.participants?.includes(user.id))
    : [];

  async function toggleFollow() {
    if (!data) return;
    const next = !following;
    setBusy(true);
    // Optimiste, compteur compris : suivre un lieu est un geste sans
    // conséquence pour personne, et le faire attendre un aller-retour donnerait
    // l'impression d'un bouton mort.
    setFollow({ following: next, followersCount: followersCount + (next ? 1 : -1) });

    try {
      setFollow(await setFollowingLair(lairId, next));
    } catch {
      setFollow({ following, followersCount });
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="screen">
        <BackHeader title={t("lairs.detailTitle")} />
        <StatusView loading={lair.loading} error={lair.error} onRetry={lair.reload} />
      </div>
    );
  }

  const followButton = isAuthenticated ? (
    <button
      className={`btn ${following ? "btn--outline" : "btn--grad"} follow-btn`}
      disabled={busy}
      onClick={toggleFollow}
    >
      {following ? <CheckIcon size={16} /> : <PinIcon size={16} />}
      {following ? t("lairs.follow.following") : t("lairs.follow.action")}
    </button>
  ) : (
    <Link to="/login" className="btn btn--grad follow-btn">
      <PinIcon size={16} />
      {t("lairs.follow.action")}
    </Link>
  );

  const directions = directionsUrl(data);

  return (
    <div className="screen lair-theme" style={accent.style}>
      <BackHeader title={data.name} action={followButton} />

      {data.banner && (
        <CachedImage src={data.banner} alt="" className="lair-hero__banner" />
      )}

      <div className="lair-hero">
        {/* Le carré du lieu, comme dans l'annuaire — c'est la forme qui dit
            qu'on est chez un lieu et non chez un joueur. Faute de logo, deux
            lettres sur l'accent du lieu : la forme doit être là même quand la
            marque manque, sinon l'identité ne tient qu'aux boutiques qui ont
            pensé à téléverser une image. */}
        {data.options?.theme?.logo ? (
          <CachedImage
            src={data.options.theme.logo}
            alt=""
            className="sigil-lair sigil-lair--lg"
          />
        ) : (
          <span
            className="sigil-lair sigil-lair--lg"
            style={tintStyle(colorFor(data.id, data.options?.theme?.accentColor))}
          >
            {initialsOf(data.name)}
          </span>
        )}
        <div className="lair-hero__body">
          <h1 className="lair-hero__name">
            {data.name}
            {data.isPrivate && <LockIcon size={16} />}
          </h1>
          <div className="chip-row lair-hero__badges">
            {data.isPro && <span className="chip chip--grad">{t("lairs.pro")}</span>}
            {/* Le type de lieu est rangé sous `about` mais s'affiche en tête,
                comme sur le web (`LairHero`) : c'est de l'identité, pas de la
                section, et éteindre celle-ci ne doit pas l'effacer. */}
            {data.options?.about?.category && (
              <span className="chip">{data.options.about.category}</span>
            )}
            {opening.isOpen !== null && (
              <span className={`chip${opening.isOpen ? " chip--accent" : ""}`}>
                {opening.isOpen
                  ? opening.closesAt
                    ? t("lairs.hours.openUntil", { time: opening.closesAt })
                    : t("lairs.hours.open")
                  : t("lairs.hours.closed")}
              </span>
            )}
            <span className="chip">
              <UsersIcon size={13} />
              {t("lairs.followers", { count: followersCount })}
            </span>
          </div>
          {data.address && directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
            >
              <PinIcon size={13} />
              {data.address}
            </a>
          )}
        </div>
      </div>

      <Tabs<Tab>
        className="lair-tabs"
        current={tab}
        onSelect={setTab}
        items={TABS.map((key) => ({ key, label: t(`lairs.tabs.${key}`) }))}
      />

      {tab === "news" && (
        <>
          {/* Le direct passe devant tout : c'est périssable. */}
          {live && (
            <a
              href={live}
              target="_blank"
              rel="noopener noreferrer"
              className="card profile-live"
            >
              <span className="live-dot" />
              <div>
                <p className="list-row__title">
                  {data.options?.live?.title || t("lairs.live.title")}
                </p>
                <p className="list-row__sub">{t("lairs.live.watch")}</p>
              </div>
              <ExternalLinkIcon size={16} />
            </a>
          )}

          {sections.map((section) => {
            switch (section.key) {
              case "news":
                return section.enabled && news.length > 0 ? (
                  <div key={section.key}>
                    {news.map((item) => (
                      <LairNewsCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : null;

              case "featured":
                return section.enabled && featured ? (
                  <LairFeaturedEvent key={section.key} event={featured} />
                ) : null;

              case "calendar":
                // Le calendrier est toujours allumé : c'est ce qu'on vient
                // chercher ici. Ses cinq premières lignes, le reste à l'onglet.
                return (
                  <div key={section.key}>
                    <StatusView loading={events.loading && !events.data} error={events.error} onRetry={events.reload} />
                    {events.data && (
                      <LairUpcomingEvents
                        events={upcoming}
                        followedGameNames={followedGameNames}
                        myUserId={user?.id}
                        onChanged={events.reload}
                        onSeeAgenda={() => setTab("agenda")}
                      />
                    )}
                  </div>
                );

              default:
                // Les médias et l'à-propos ont leur onglet.
                return null;
            }
          })}

          <LairPracticalInfo lair={data} place={place} />

          {news.length === 0 && !live && upcoming.length === 0 && events.data && (
            <StatusView empty={t("lairs.news.empty")} />
          )}
        </>
      )}

      {tab === "agenda" && (
        <>
          {registrations.length > 0 && (
            <section className="card lair-registrations">
              <Movement
                section
                title={t("lairs.portal.agenda.registrations")}
                aside={String(registrations.length)}
              />
              <ul className="lair-registrations__list">
                {registrations.slice(0, 5).map((event) => (
                  <li key={event.id}>
                    <Link to={`/events/${event.id}`} className="lair-registrations__item">
                      <span className="lair-registrations__date">
                        {new Date(event.startDateTime).toLocaleDateString(locale, {
                          weekday: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="lair-registrations__name">{event.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <StatusView loading={events.loading && !events.data} error={events.error} onRetry={events.reload} />
          {events.data && (
            <LairAgenda
              lairId={lairId}
              mode={data.options?.calendar?.mode ?? "CALENDAR"}
              yearEvents={events.data}
              myUserId={user?.id}
              onChanged={events.reload}
            />
          )}

          {(about?.rhythm?.length ?? 0) > 0 && (
            <section>
              <Movement section title={t("lairs.about.rhythm")} />
              {about?.rhythm?.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="list-row">
                  <div className="list-row__body">
                    <p className="list-row__title">{entry.label}</p>
                    <p className="list-row__sub">{entry.value}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === "games" && (
        <>
          {lairGames.length === 0 ? (
            <StatusView loading={games.loading} empty={games.data ? t("lairs.games.empty") : undefined} />
          ) : (
            <>
              <p className="muted lair-games__count">
                {t("lairs.portal.games.count", { count: lairGames.length })}
              </p>
              <div className="game-grid">
                {lairGames.map((game) => {
                  const color = colorFor(game._id);
                  const count = upcomingByGame[game.name] ?? 0;
                  return (
                    <Link
                      key={game._id}
                      to={`/games/${game.slug ?? game._id}`}
                      className="game-tile"
                    >
                      <span
                        className="game-tile__wash"
                        style={{ background: `linear-gradient(180deg, ${color}24, transparent)` }}
                      />
                      <span className="game-tile__head">
                        {game.icon ? (
                          <CachedImage src={game.icon} alt="" className="game-tile__icon" />
                        ) : (
                          <span className="game-tile__icon" style={tintStyle(color)}>
                            {initialsOf(game.name)}
                          </span>
                        )}
                      </span>
                      <h2 className="game-tile__name">{game.name}</h2>
                      <p className={`game-tile__desc lair-game-tile__events${count > 0 ? " lair-game-tile__events--some" : ""}`}>
                        <CalendarIcon size={12} />
                        {t("lairs.portal.games.upcoming", { count })}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {tab === "about" && (
        <>
          {/* La section « à propos » de la vitrine, si le lieu l'a laissée
              allumée. Ce qu'elle couvre, c'est exactement `options.about` —
              présentation, équipements, photos, équipe, accès. Les liens, le
              contact et les horaires vivent ailleurs dans `options` et restent
              affichés : ce sont des informations pratiques, pas la page que le
              lieu a choisi d'écrire sur lui-même. */}
          {about && (
            <>
              {about.description && (
                <section className="card">
                  <UserMarkdown>{about.description}</UserMarkdown>
                </section>
              )}

              {(about.photos?.length ?? 0) > 0 && (
                <section>
                  <Movement section title={t("lairs.portal.about.photos")} />
                  <div className="lair-photos">
                    {about.photos?.map((photo, index) => (
                      <CachedImage key={`${photo}-${index}`} src={photo} alt="" className="lair-photos__item" />
                    ))}
                  </div>
                </section>
              )}

              {(about.amenities?.length ?? 0) > 0 && (
                <section className="card">
                  <Movement section title={t("lairs.about.amenities")} />
                  <div className="chip-set">
                    {about.amenities?.map((amenity) => (
                      <span key={amenity} className="chip">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {(about.organizers?.length ?? 0) > 0 && (
                <section>
                  <Movement section title={t("lairs.about.team")} />
                  {about.organizers?.map((organizer, index) => (
                    <div key={`${organizer.name}-${index}`} className="list-row">
                      {organizer.avatar && (
                        <CachedImage src={organizer.avatar} alt="" className="avatar" />
                      )}
                      <div className="list-row__body">
                        <p className="list-row__title">{organizer.name}</p>
                        {organizer.role && <p className="list-row__sub">{organizer.role}</p>}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {(about.transit || about.parking) && (
                <section className="card">
                  <Movement section title={t("lairs.about.access")} />
                  {about.transit && (
                    <p className="lair-about__line">
                      <strong>{t("lairs.portal.about.transit")}</strong> {about.transit}
                    </p>
                  )}
                  {about.parking && (
                    <p className="lair-about__line">
                      <strong>{t("lairs.portal.about.parking")}</strong> {about.parking}
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {(website || links.length > 0) && (
            <section>
              <Movement section title={t("lairs.about.links")} />
              <div className="profile-links">
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-link"
                  >
                    <ExternalLinkIcon size={13} />
                    {t("lairs.about.website")}
                  </a>
                )}
                {links.map((link, index) => (
                  <a
                    key={`${link.url}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="header-link"
                  >
                    <ExternalLinkIcon size={13} />
                    {link.label || t(`lairs.about.network.${link.type}`)}
                  </a>
                ))}
              </div>
            </section>
          )}

          <LairPracticalInfo lair={data} place={place} />
          <LairHours hours={data.options?.openingHours} />

          <section className="card lair-follow-card">
            <p className="lair-follow-card__count">
              <UsersIcon size={16} />
              {t("lairs.followers", { count: followersCount })}
            </p>
            <p className="muted">{t("lairs.portal.about.followHint")}</p>
            {followButton}
          </section>
        </>
      )}
    </div>
  );
}
