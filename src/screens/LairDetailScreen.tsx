import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listEvents } from "../api/events";
import { getLair, setFollowingLair } from "../api/lairs";
import { listGames } from "../api/games";
import type { JoutesEvent, LairNewsItem } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CachedImage } from "../components/CachedImage";
import { LairHours } from "../components/LairHours";
import { LairNewsCard } from "../components/LairNewsCard";
import { Movement } from "../components/Movement";
import { StatusView } from "../components/StatusView";
import { UserMarkdown } from "../components/UserMarkdown";
import {
  CheckIcon,
  ChevronIcon,
  ExternalLinkIcon,
  LockIcon,
  PinIcon,
  UsersIcon,
} from "../components/icons";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { colorFor, initialsOf, tintStyle } from "../lib/game-visuals";
import { isSectionEnabled, readLairSections } from "../lib/lair-sections";
import { readLairAccent } from "../lib/lair-theme";
import { externalUrl } from "../lib/lair-urls";
import { useAuth } from "../store/auth";

const TABS = ["news", "agenda", "games", "about"] as const;
type Tab = (typeof TABS)[number];

/**
 * L'adresse d'un itinéraire, sur la carte du système.
 *
 * `maps.apple.com` sur iOS, `google.com/maps` ailleurs : un lien plutôt qu'un
 * plan intégré — le mobile n'embarque pas de carte, et celle du système sait
 * faire ce qu'on lui demande ici, guider quelqu'un jusqu'à la porte.
 */
function directionsUrl(address: string): string {
  const query = encodeURIComponent(address);
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

/** Les annonces, l'épinglée en tête puis les autres de la plus récente. */
function orderedNews(news: LairNewsItem[] | undefined): LairNewsItem[] {
  return [...(news ?? [])].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
}

function EventRow({ event, locale }: { event: JoutesEvent; locale: string }) {
  return (
    <Link to={`/events/${event.id}`} className="list-row list-row--link">
      <div className="list-row__body">
        <p className="list-row__title">{event.name}</p>
        <p className="list-row__sub">
          {[formatDate(event.startDateTime, locale), event.game?.name ?? event.gameName]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

/**
 * La vitrine d'un lieu.
 *
 * Quatre onglets, et les blocs de l'onglet « Actualités » dans l'ordre que le
 * lieu a réglé sur le web (`readLairSections`). Une section éteinte n'est pas
 * rendue ; le calendrier ne peut pas l'être, c'est ce qu'on vient chercher ici.
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
  const { isAuthenticated } = useAuth();
  const locale = currentLocale();

  const [tab, setTab] = useState<Tab>("news");
  const [follow, setFollow] = useState<{
    following: boolean;
    followersCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Changer de lieu garde le composant monté : sans remise à zéro, le suivant
  // hériterait du « je le suis » et du compteur du précédent.
  useEffect(() => {
    setFollow(null);
    setTab("news");
  }, [lairId]);

  const lair = useApi(() => getLair(lairId), [lairId]);
  const data = lair.data ?? null;

  const games = useApi(() => listGames(), []);
  const events = useApi(
    () => (data ? listEvents({ lairId, year: new Date().getFullYear() }) : Promise.resolve([])),
    [data?.id, lairId],
  );

  const sections = useMemo(() => (data ? readLairSections(data) : []), [data]);
  const accent = useMemo(() => (data ? readLairAccent(data) : { color: null, style: {} }), [data]);

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

  const upcoming = useMemo(
    () =>
      (events.data ?? [])
        .filter((event) => new Date(event.endDateTime || event.startDateTime) >= new Date())
        .filter((event) => event.status !== "cancelled")
        .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)),
    [events.data],
  );

  const featured = data?.options?.featuredEventId
    ? upcoming.find((event) => event.id === data.options?.featuredEventId)
    : undefined;

  const gameNames = (data?.games ?? []).flatMap((id) => {
    const game = (games.data ?? []).find((entry) => entry._id === id);
    return game ? [game] : [];
  });

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

  return (
    <div className="screen lair-theme" style={accent.style}>
      <BackHeader
        title={data.name}
        action={
          // Suivre demande une session : sans compte, le bouton ne pourrait que
          // rendre 401, et un bouton qui échoue toujours vaut moins qu'aucun.
          isAuthenticated ? (
            <button
              className={`btn ${following ? "btn--outline" : "btn--grad"} follow-btn`}
              disabled={busy}
              onClick={toggleFollow}
            >
              {following ? <CheckIcon size={16} /> : <PinIcon size={16} />}
              {following ? t("lairs.follow.following") : t("lairs.follow.action")}
            </button>
          ) : undefined
        }
      />

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
            <span className="chip">
              <UsersIcon size={13} />
              {t("lairs.followers", { count: followersCount })}
            </span>
          </div>
          {data.address && (
            <a
              href={directionsUrl(data.address)}
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

      <div className="segmented" style={{ margin: "12px 0" }}>
        {TABS.map((key) => (
          <button
            key={key}
            className={`segmented__item${tab === key ? " segmented__item--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {t(`lairs.tabs.${key}`)}
          </button>
        ))}
      </div>

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
                  <div key={section.key}>
                    <Movement section title={t("lairs.featured")} />
                    <EventRow event={featured} locale={locale} />
                  </div>
                ) : null;

              default:
                // Le calendrier, les médias et l'à-propos ont leur onglet : les
                // empiler ici en ferait une page à faire défiler deux fois.
                return null;
            }
          })}

          <LairHours hours={data.options?.openingHours} />

          {news.length === 0 && !live && (
            <StatusView empty={t("lairs.news.empty")} />
          )}
        </>
      )}

      {tab === "agenda" && (
        <>
          <StatusView
            loading={events.loading}
            error={events.error}
            onRetry={events.reload}
            empty={
              !events.loading && !events.error && upcoming.length === 0
                ? t("lairs.agenda.empty")
                : undefined
            }
          />
          {upcoming.map((event) => (
            <EventRow key={event.id} event={event} locale={locale} />
          ))}
        </>
      )}

      {tab === "games" && (
        <>
          {gameNames.length === 0 ? (
            <StatusView empty={t("lairs.games.empty")} />
          ) : (
            gameNames.map((game) => (
              <Link
                key={game._id}
                to={`/games/${game.slug ?? game._id}`}
                className="list-row list-row--link"
              >
                {game.icon && (
                  <CachedImage src={game.icon} alt="" className="list-row__thumb" />
                )}
                <div className="list-row__body">
                  <p className="list-row__title">{game.name}</p>
                </div>
                <span className="chevron">
                  <ChevronIcon size={18} />
                </span>
              </Link>
            ))
          )}
        </>
      )}

      {tab === "about" && (
        <>
          {/* La section « à propos » de la vitrine, si le lieu l'a laissée
              allumée. Ce qu'elle couvre, c'est exactement `options.about` —
              présentation, équipements, rythme, équipe, accès. Les liens, le
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

              {(about.rhythm?.length ?? 0) > 0 && (
                <section>
                  <Movement section title={t("lairs.about.rhythm")} />
                  {about.rhythm?.map((entry, index) => (
                    <div key={`${entry.label}-${index}`} className="list-row">
                      <div className="list-row__body">
                        <p className="list-row__title">{entry.label}</p>
                        <p className="list-row__sub">{entry.value}</p>
                      </div>
                    </div>
                  ))}
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
                  {about.transit && <p className="list-row__sub">{about.transit}</p>}
                  {about.parking && <p className="list-row__sub">{about.parking}</p>}
                </section>
              )}
            </>
          )}

          {(website || links.length > 0 || data.options?.contact?.email) && (
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
                {/* Le téléphone est volontairement absent : `tel:` n'ouvre rien
                    dans la vue web d'une application de bureau, et un lien qui
                    ne fait rien vaut moins qu'un numéro qu'on lit. */}
                {data.options?.contact?.email && (
                  <a href={`mailto:${data.options.contact.email}`} className="header-link">
                    <ExternalLinkIcon size={13} />
                    {data.options.contact.email}
                  </a>
                )}
              </div>
              {data.options?.contact?.phone && (
                <p className="list-row__sub">{data.options.contact.phone}</p>
              )}
            </section>
          )}

          <LairHours hours={data.options?.openingHours} />
        </>
      )}
    </div>
  );
}
