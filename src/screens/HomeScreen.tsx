import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getHomeFeed } from "../api/feed";
import type { FeedEntry, HomeLive } from "../api/types";
import { CachedImage } from "../components/CachedImage";
import { DeckRow } from "../components/DeckRow";
import { EventCard } from "../components/EventCard";
import { FeedCard, feedGenre, type FeedGenre } from "../components/FeedCard";
import { LairCard } from "../components/LairCard";
import { LocationSheet } from "../components/LocationSheet";
import { Movement } from "../components/Movement";
import { PlacePill } from "../components/PlacePill";
import { StatusView } from "../components/StatusView";
import {
  CalendarIcon,
  ChevronIcon,
  ExternalLinkIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "../components/icons";
import { useApi } from "../hooks/useApi";
import { useSavedPlace } from "../hooks/useSavedPlace";
import { useSearchParam, useSearchParamState } from "../hooks/useSearchParamState";
import { selectFeedEntries } from "../lib/feed-mix";
import { colorFor, tintStyle } from "../lib/game-visuals";
import { externalUrl } from "../lib/lair-urls";
import { useAuth } from "../store/auth";

/** Ce que le fil montre, et ce qu'une source au plus peut y prendre — comme le site. */
const MAX_FEED = 6;
const FEED_CAPS: Partial<Record<FeedGenre, number>> = { social: 2 };
const GENRES = ["all", "actu", "video", "deck", "social"] as const;
type GenreFilter = (typeof GENRES)[number];

function LiveCard({ live }: { live: HomeLive }) {
  const { t } = useTranslation();
  const url = externalUrl(live.url);
  const to = live.kind === "game" ? `/games/${live.id}` : `/lairs/${live.id}`;
  const thumbnail = externalUrl(live.thumbnail);

  return (
    <div className="home-live">
      <Link to={to} className="home-live__link">
        {thumbnail ? (
          <span className="home-live__media">
            <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </span>
        ) : (
          <span className="home-live__media home-live__media--empty" />
        )}
        <span className="home-live__body">
          <span className="home-live__badge">
            <span className="live-dot" />
            {t(live.kind === "game" ? "home.lives.game" : "home.lives.lair")}
          </span>
          <span className="home-live__title">{live.title}</span>
          <span className="home-live__source">
            {live.source}
            {typeof live.viewers === "number" && ` · ${t("home.lives.viewers", { count: live.viewers })}`}
          </span>
        </span>
      </Link>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="home-live__watch">
          <ExternalLinkIcon size={13} />
          {t("home.lives.watch")}
        </a>
      )}
    </div>
  );
}

/**
 * L'accueil : ce qui bouge, sur les jeux qu'on suit.
 *
 * Une seule composition pour deux publics, comme sur le site : les puces de
 * jeux, les directs, les sept prochains jours, le fil à quatre sources, les
 * lieux et les decks. Ce qui change est ce que la page n'a plus le droit de
 * savoir — un visiteur lit tout, et les lieux autour de la ville qu'il a
 * dite ; un compte lit ses jeux, ses lieux, ses decks.
 *
 * Tout vient d'une requête (`GET /feed`), composée par le serveur avec les
 * règles de la page web : le téléphone et le site ne peuvent pas montrer
 * deux accueils. Le plafond du fil (`selectFeedEntries`) reste ici, parce
 * que les puces de genre doivent compter ce que chaque genre a.
 */
export function HomeScreen() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { place, save, clear } = useSavedPlace();

  // Les mêmes clés que les autres écrans (`game` sur /news et /events) : une
  // URL se partage et se lit, elle ne doit pas changer de vocabulaire.
  const [gameParam, setGameParam] = useSearchParam("game");
  const [genre, setGenre] = useSearchParamState<GenreFilter>("feed", GENRES, "all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const lang = i18n.resolvedLanguage ?? i18n.language;
  const feed = useApi(
    () =>
      getHomeFeed(
        {
          gameId: gameParam ?? undefined,
          ...(place
            ? { lat: place.latitude, lon: place.longitude, radius: place.radiusKm, place: place.label }
            : {}),
          lang,
          limit: MAX_FEED,
        },
        user?.id ?? null,
      ),
    [gameParam, place?.latitude, place?.longitude, place?.radiusKm, lang, user?.id],
  );
  const data = feed.data;

  const gameNames = useMemo(
    () => new Map((data?.games.games ?? []).map((game) => [game.id, game.name])),
    [data?.games.games],
  );

  const entries = useMemo<FeedEntry[]>(() => {
    const all = data?.feed ?? [];
    if (genre === "all") {
      return selectFeedEntries(
        all.map((entry) => ({ entry, type: feedGenre(entry) })),
        { max: MAX_FEED, caps: FEED_CAPS },
      ).map(({ entry }) => entry);
    }
    return all.filter((entry) => feedGenre(entry) === genre).slice(0, MAX_FEED);
  }, [data?.feed, genre]);

  const counts = useMemo(() => {
    const all = data?.feed ?? [];
    const result: Record<GenreFilter, number> = { all: all.length, actu: 0, video: 0, deck: 0, social: 0 };
    for (const entry of all) result[feedGenre(entry)] += 1;
    return result;
  }, [data?.feed]);

  const firstName = user?.displayName ?? user?.name ?? user?.username ?? "";
  const allLabel = data?.games.source === "defaults" ? t("home.games.all") : t("home.games.allMine");

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <p className="eyebrow">
            <img src="/joutes-logo.png" alt="" className="eyebrow__logo" />
            {t("home.eyebrow")}
          </p>
          <h1 className="screen-title">
            {isAuthenticated && firstName ? t("home.greeting", { name: firstName }) : t("home.title")}
          </h1>
          {data && (
            <p className="screen-subtitle">
              {isAuthenticated
                ? [
                    t("home.summary.events", { count: data.agenda.length }),
                    data.lives.length > 0 ? t("home.summary.lives", { count: data.lives.length }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("home.proposition.subtitle")}
            </p>
          )}
        </div>
        <div className="head-actions">
          <button
            className="icon-button"
            aria-label={t("common.search")}
            onClick={() => navigate("/search")}
          >
            <SearchIcon size={20} />
          </button>
          <button
            className="icon-button"
            aria-label={t("home.socialAction")}
            onClick={() => navigate("/social")}
          >
            <UsersIcon size={20} />
          </button>
          {isAuthenticated && user ? (
            <button
              className="avatar-button"
              aria-label={t("common.settings")}
              onClick={() => navigate("/settings")}
            >
              {user.avatar ? (
                <CachedImage src={user.avatar} alt="" className="avatar avatar--sm" />
              ) : (
                <span className="avatar avatar--sm" style={tintStyle(colorFor(user.id))}>
                  {(firstName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label={t("common.settings")}
              onClick={() => navigate("/settings")}
            >
              <SettingsIcon size={20} />
            </button>
          )}
        </div>
      </div>

      {!isAuthenticated && (
        <div className="card home-proposition">
          <p className="home-proposition__text">{t("home.proposition.text")}</p>
          <div className="home-proposition__actions">
            <Link to="/login" className="btn btn--grad">
              {t("home.proposition.signUp")}
            </Link>
            <PlacePill place={place} onOpen={() => setSheetOpen(true)} />
          </div>
        </div>
      )}

      {data && data.games.games.length > 0 && (
        <div className="chip-row">
          <button
            className={`chip-filter${gameParam === null ? " chip-filter--active" : ""}`}
            onClick={() => setGameParam(null)}
          >
            {allLabel}
          </button>
          {data.games.games.map((game) => (
            <button
              key={game.id}
              className={`chip-filter${gameParam === (game.slug ?? game.id) ? " chip-filter--active" : ""}`}
              onClick={() => setGameParam(game.slug ?? game.id)}
            >
              {game.name}
            </button>
          ))}
        </div>
      )}

      <StatusView loading={feed.loading && !data} error={feed.error} onRetry={feed.reload} />

      {data && (
        <>
          {data.lives.length > 0 && (
            <div className="home-lives">
              {data.lives.map((live) => (
                <LiveCard key={live.key} live={live} />
              ))}
            </div>
          )}

          <section className="home-section">
            <Movement
              section
              title={t("home.agenda.title")}
              aside={t("home.agenda.window", { days: 7 })}
            />
            {data.agenda.length === 0 ? (
              <p className="status muted">{t("home.agenda.empty")}</p>
            ) : (
              data.agenda.map((event) => (
                <EventCard key={event.id} event={event} myUserId={user?.id} onChanged={feed.reload} />
              ))
            )}
            <Link to="/events" className="home-section__more">
              <CalendarIcon size={14} />
              {t("home.agenda.all")}
              <ChevronIcon size={16} />
            </Link>
          </section>

          <section className="home-section">
            <Movement section title={t("home.feed.title")} />
            <div className="chip-row">
              {GENRES.map((key) => (
                <button
                  key={key}
                  className={`chip-filter${genre === key ? " chip-filter--active" : ""}`}
                  onClick={() => setGenre(key)}
                >
                  {t(`home.feed.types.${key}`)}
                  {counts[key] > 0 && <span className="chip-filter__count">{counts[key]}</span>}
                </button>
              ))}
            </div>
            {entries.length === 0 ? (
              <p className="status muted">{t("home.feed.empty")}</p>
            ) : (
              entries.map((entry) => (
                <FeedCard
                  key={`${entry.type}:${entry.id}`}
                  entry={entry}
                  gameName={entry.gameId ? gameNames.get(entry.gameId) : undefined}
                />
              ))
            )}
            <Link to="/news" className="home-section__more">
              {t("home.feed.allNews")}
              <ChevronIcon size={16} />
            </Link>
          </section>

          <section className="home-section">
            <Movement
              section
              title={t(data.lairs.source === "followed" ? "home.lairs.followed" : "home.lairs.nearby")}
              aside={data.lairs.source === "nearby" && place ? place.city ?? place.label : undefined}
            />
            {data.lairs.lairs.length === 0 ? (
              <div className="home-empty">
                <p className="status muted">
                  {t(isAuthenticated ? "home.lairs.emptyFollowed" : "home.lairs.emptyNearby")}
                </p>
                {!isAuthenticated && !place && (
                  <PlacePill place={place} onOpen={() => setSheetOpen(true)} />
                )}
              </div>
            ) : (
              data.lairs.lairs.slice(0, 3).map((lair) => <LairCard key={lair.id} lair={lair} />)
            )}
            <Link to="/lairs" className="home-section__more">
              {t("home.lairs.all")}
              <ChevronIcon size={16} />
            </Link>
          </section>

          <section className="home-section">
            <Movement
              section
              title={t(data.decks.source === "mine" ? "home.decks.mine" : "home.decks.featured")}
            />
            {data.decks.decks.length === 0 ? (
              <p className="status muted">{t("home.decks.empty")}</p>
            ) : (
              data.decks.decks.map((deck) => (
                <DeckRow key={deck.id} deck={deck} showAuthor={data.decks.source === "featured"} />
              ))
            )}
            <Link to="/decks" className="home-section__more">
              {t("home.decks.all")}
              <ChevronIcon size={16} />
            </Link>
          </section>
        </>
      )}

      {sheetOpen && (
        <LocationSheet
          initial={place}
          onSave={(next) => {
            save(next);
            setSheetOpen(false);
          }}
          onClear={clear}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
