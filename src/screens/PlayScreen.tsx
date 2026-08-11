import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listMyGameMatches } from "../api/game-matches";
import { listGames } from "../api/games";
import { listPlayingTournamentsPage, syncTournamentKeys } from "../api/tournaments";
import type {
  GameMatchSummary,
  TournamentPlayingEntry,
  TournamentStatus,
} from "../api/types";
import { CreateGameMatchSheet } from "../components/CreateGameMatchSheet";
import { ChevronIcon, PlusIcon, ScanIcon, SwordsIcon, TrophyIcon } from "../components/icons";
import { JoinPlaySheet } from "../components/JoinPlaySheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { useTournamentLive } from "../hooks/useTournamentLive";
import { currentLocale } from "../i18n";
import { getSyncKeys } from "../lib/tournament-sync-storage";
import { formatDuration, timerIsPaused, timerRemainingSeconds } from "../lib/tournament-timer";
import { useAuth } from "../store/auth";

const PAGE_SIZE = 20;

type Filter = "current" | "past";
type Section = "tournaments" | "matches";

interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
  /** Renseignés pour un tournoi rejoint avec un compte ; absents en synchronisation invité. */
  startsAt?: string;
  location?: string;
  gameId?: string;
}

/** Filtres partagés par les deux volets : un jeu, et une fenêtre de dates. */
interface CommonFilters {
  gameId: string;
  from: string;
  to: string;
}

const NO_FILTERS: CommonFilters = { gameId: "", from: "", to: "" };

export function tournamentStatusChipClass(status: TournamentStatus): string {
  switch (status) {
    case "in-progress":
      return "chip--accent";
    case "completed":
      return "";
    default:
      return "chip--grad";
  }
}

function formatStart(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Filtres communs aux deux volets. Le jeu vient du catalogue : un identifiant
 * saisi à la main ne dirait rien à personne.
 */
function FiltersRow({
  filters,
  onChange,
  games,
}: {
  filters: CommonFilters;
  onChange: (filters: CommonFilters) => void;
  games: { id: string; name: string }[];
}) {
  const { t } = useTranslation();

  return (
    <div className="card-filters">
      <div className="card-filters__row">
        <select
          value={filters.gameId}
          onChange={(e) => onChange({ ...filters, gameId: e.currentTarget.value })}
        >
          <option value="">{t("play.filters.allGames")}</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </div>
      <div className="card-filters__row">
        <label className="field field--inline">
          <span className="field__label">{t("play.filters.from")}</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.currentTarget.value })}
          />
        </label>
        <label className="field field--inline">
          <span className="field__label">{t("play.filters.to")}</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.currentTarget.value })}
          />
        </label>
      </div>
      {(filters.gameId || filters.from || filters.to) && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onChange({ ...NO_FILTERS })}
        >
          {t("play.filters.clear")}
        </button>
      )}
    </div>
  );
}

/**
 * Carte héro d'un tournoi en cours : la ronde et le minuteur du jour J, sans
 * ouvrir la fiche. C'est la seule ligne de cette liste qui bouge en direct.
 */
function LiveTournamentCard({ tournament }: { tournament: TournamentSummary }) {
  const { t } = useTranslation();
  const { state, serverOffsetMs } = useTournamentLive(tournament.id, 15000);
  const remaining = timerRemainingSeconds(state?.timer, serverOffsetMs);
  const announcement = state?.announcements[0];

  return (
    <Link to={`/tournaments/${tournament.id}`} className="live-card">
      <div className="live-card__top">
        <div className="live-card__titles">
          <p className="live-card__eyebrow">{t("tournaments.liveNow")}</p>
          <p className="live-card__name">{tournament.name}</p>
          {state?.roundNumber != null && (
            <p className="live-card__meta">
              {t("tournaments.roundLabel", { number: state.roundNumber })}
            </p>
          )}
        </div>
        {remaining !== null && (
          <div className="live-card__timer">
            <p className={`live-card__clock${remaining < 0 ? " live-card__clock--expired" : ""}`}>
              {formatDuration(remaining)}
            </p>
            {timerIsPaused(state?.timer) && (
              <p className="live-card__timer-label">{t("tournaments.timerPaused")}</p>
            )}
          </div>
        )}
      </div>
      {announcement && <p className="live-card__announce">{announcement.message}</p>}
      <span className="live-card__cta">{t("tournaments.openMyMatch")}</span>
    </Link>
  );
}

function TournamentRow({ tournament }: { tournament: TournamentSummary }) {
  const { t } = useTranslation();
  const meta = [
    tournament.startsAt ? formatStart(tournament.startsAt) : null,
    tournament.location,
  ].filter(Boolean);

  return (
    <Link to={`/tournaments/${tournament.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <SwordsIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{tournament.name}</p>
        <p className="list-row__sub">
          <span className={`chip status-badge ${tournamentStatusChipClass(tournament.status)}`}>
            {t(`tournaments.status.${tournament.status}`)}
          </span>
          {meta.length > 0 && <span className="muted"> {meta.join(" · ")}</span>}
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

/**
 * Volet « tournois » : ceux où le compte est inscrit, et ceux rejoints en
 * invité sur cet appareil.
 *
 * Les tournois du compte sont paginés, cherchés et filtrés **par le serveur** —
 * la liste s'allonge à chaque tournoi joué, et tout charger pour n'en montrer
 * dix serait payer le réseau pour rien. Ceux rejoints en invité tiennent, eux,
 * dans les quelques clés stockées sur l'appareil : ils sont résolus en une fois
 * et filtrés ici, faute d'endpoint qui saurait les chercher.
 */
function TournamentsPane({
  filters,
  onFiltersChange,
  games,
}: {
  filters: CommonFilters;
  onFiltersChange: (filters: CommonFilters) => void;
  games: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [filter, setFilter] = useState<Filter>("current");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, filters.gameId, filters.from, filters.to, isAuthenticated]);

  // Terminés cachés par défaut : ce qu'on ouvre l'application pour retrouver,
  // c'est le tournoi de la journée. Les autres restent à une puce de distance.
  const statuses: TournamentStatus[] =
    filter === "past" ? ["completed"] : ["draft", "in-progress"];

  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const account = isAuthenticated
      ? listPlayingTournamentsPage({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          statuses,
          gameId: filters.gameId || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        })
      : Promise.resolve({ tournaments: [] as TournamentPlayingEntry[], totalPages: 1 });

    // La synchronisation invité ne connaît ni page ni filtre : elle ne rend que
    // les quelques tournois dont l'appareil a la clé, joints à la première page.
    const guests = page === 1 ? syncTournamentKeys(Object.values(getSyncKeys())) : Promise.resolve([]);

    Promise.allSettled([account, guests])
      .then(([accountResult, guestResult]) => {
        if (id !== requestId.current) return;

        // `/tournaments/playing` fait autorité pour un compte connecté (401,
        // panne réseau…) : on ne l'avale pas en liste vide, sous peine
        // d'afficher un « aucun tournoi » trompeur.
        if (accountResult.status === "rejected") {
          throw accountResult.reason;
        }

        const fromAccount: TournamentSummary[] = accountResult.value.tournaments.map(
          ({ tournament }) => ({
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
            startsAt: tournament.startsAt,
            location: tournament.location,
            gameId: tournament.gameId,
          }),
        );

        const fromGuests: TournamentSummary[] =
          guestResult.status === "fulfilled"
            ? guestResult.value
                .map((entry) => entry.tournament)
                .filter((tournament) => statuses.includes(tournament.status))
                .filter((tournament) =>
                  search
                    ? tournament.name.toLowerCase().includes(search.toLowerCase())
                    : true,
                )
            : [];

        const byId = new Map<string, TournamentSummary>();
        for (const tournament of fromGuests) byId.set(tournament.id, tournament);
        for (const tournament of fromAccount) byId.set(tournament.id, tournament);
        const merged = Array.from(byId.values());

        setItems((previous) => (page === 1 ? merged : [...previous, ...merged]));
        setTotalPages(accountResult.value.totalPages ?? 1);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("tournaments.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // `statuses` est dérivé de `filter` : le lister ferait un nouveau tableau à
    // chaque rendu, et l'effet tournerait sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, page, search, filter, filters.gameId, filters.from, filters.to, retryTick, t]);

  // Un tournoi peut être filtré sur un jeu que la synchronisation invité ne
  // connaît pas : le filtre par jeu ne s'applique qu'à ce qui en porte un.
  const visible = filters.gameId
    ? items.filter((tournament) => !tournament.gameId || tournament.gameId === filters.gameId)
    : items;

  // Le tournoi du jour prend la carte héro ; les autres restent en liste.
  const live = filter === "current" ? visible.filter((tournament) => tournament.status === "in-progress") : [];
  const rest = visible.filter((tournament) => !live.some((entry) => entry.id === tournament.id));

  return (
    <>
      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 16 }}
        onClick={() => setJoining(true)}
      >
        <ScanIcon size={18} />
        {t("play.joinAction")}
      </button>

      <div className="search-field">
        <input
          type="search"
          placeholder={t("tournaments.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
      </div>

      <FiltersRow filters={filters} onChange={onFiltersChange} games={games} />

      {/* Second niveau de filtre : des puces plutôt qu'un second contrôle
          segmenté, qui se confondrait avec celui des sections. */}
      <div className="chip-row">
        <button
          className={`chip-filter${filter === "current" ? " chip-filter--active" : ""}`}
          onClick={() => setFilter("current")}
        >
          {t("tournaments.filterCurrent")}
        </button>
        <button
          className={`chip-filter${filter === "past" ? " chip-filter--active" : ""}`}
          onClick={() => setFilter("past")}
        >
          {t("tournaments.filterPast")}
        </button>
      </div>

      {live.map((tournament) => (
        <LiveTournamentCard key={tournament.id} tournament={tournament} />
      ))}

      {rest.map((tournament) => (
        <TournamentRow key={tournament.id} tournament={tournament} />
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetryTick((tick) => tick + 1)}
        empty={!loading && !error && visible.length === 0 ? t("tournaments.empty") : undefined}
      />

      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((current) => current + 1)}
        >
          {t("cards.loadMore")}
        </button>
      )}

      {joining && (
        <JoinPlaySheet
          onClose={() => setJoining(false)}
          onJoinedTournament={(tournamentId) => navigate(`/tournaments/${tournamentId}`)}
          onJoinedMatch={(matchId) => navigate(`/game-matches/${matchId}`)}
        />
      )}
    </>
  );
}

function GameMatchRow({ match }: { match: GameMatchSummary }) {
  const { t } = useTranslation();
  const winners = match.players.filter((player) => player.isWinner);

  return (
    <Link to={`/game-matches/${match.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <SwordsIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
      <div className="list-row__body">
        <p className="list-row__title">
          {match.game?.name ?? t("gameMatches.unknownGame")}
        </p>
        <p className="list-row__sub">
          <span className="muted">
            {formatStart(match.playedAt)}
            {" · "}
            {t("gameMatches.playersCount", { count: match.players.length })}
          </span>
        </p>
        {winners.length > 0 && (
          <p className="list-row__sub">
            <span className="chip">
              <TrophyIcon size={12} />
              {winners.map((player) => player.username).join(", ")}
            </span>
          </p>
        )}
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

/** Volet « parties » : les parties hors tournoi du compte connecté. */
function GameMatchesPane({
  filters,
  onFiltersChange,
  games,
}: {
  filters: CommonFilters;
  onFiltersChange: (filters: CommonFilters) => void;
  games: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [matches, setMatches] = useState<GameMatchSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [filters.gameId, filters.from, filters.to]);

  const requestId = useRef(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    listMyGameMatches({
      page,
      limit: PAGE_SIZE,
      gameId: filters.gameId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
      .then((response) => {
        if (id !== requestId.current) return;
        setMatches((previous) =>
          page === 1 ? response.matches : [...previous, ...response.matches],
        );
        setTotalPages(response.totalPages);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : t("gameMatches.error"));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [isAuthenticated, page, filters.gameId, filters.from, filters.to, retryTick, t]);

  // Une partie se rattache à un compte : contrairement aux tournois, il n'y a
  // pas de repli en invité à proposer ici.
  if (!isAuthenticated) {
    return <p className="status muted">{t("gameMatches.loginRequired")}</p>;
  }

  return (
    <>
      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 16 }}
        onClick={() => setCreating(true)}
      >
        <PlusIcon size={18} />
        {t("gameMatches.newAction")}
      </button>

      <FiltersRow filters={filters} onChange={onFiltersChange} games={games} />

      {matches.map((match) => (
        <GameMatchRow key={match.id} match={match} />
      ))}

      <StatusView
        loading={loading}
        error={error}
        onRetry={() => setRetryTick((tick) => tick + 1)}
        empty={!loading && !error && matches.length === 0 ? t("gameMatches.empty") : undefined}
      />

      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((current) => current + 1)}
        >
          {t("cards.loadMore")}
        </button>
      )}

      {creating && (
        <CreateGameMatchSheet
          onClose={() => setCreating(false)}
          onCreated={(matchId) => navigate(`/game-matches/${matchId}`)}
        />
      )}
    </>
  );
}

/**
 * L'onglet « Jouer » : ce qu'on joue en tournoi et ce qu'on joue à côté. Les
 * deux volets ont leurs propres commandes, d'où le contrôle segmenté plutôt
 * qu'une seule liste mêlant les deux.
 *
 * Le jeu et la fenêtre de dates sont tenus ici, au-dessus des deux volets :
 * quelqu'un qui cherche « ce que j'ai joué à Shatterpoint en mai » se pose la
 * même question des deux côtés, et la lui faire ressaisir en changeant d'onglet
 * n'aurait aucun sens.
 */
export function PlayScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("tournaments");
  const [filters, setFilters] = useState<CommonFilters>(NO_FILTERS);

  const { data: catalog } = useApi(() => listGames(), []);
  const games = useMemo(
    () =>
      [...(catalog ?? [])]
        .map((game) => ({ id: game._id, name: game.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("play.title")}</h1>
          <p className="screen-subtitle">{t("play.subtitle")}</p>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={`segmented__item${section === "tournaments" ? " segmented__item--active" : ""}`}
          onClick={() => setSection("tournaments")}
        >
          {t("play.sectionTournaments")}
        </button>
        <button
          className={`segmented__item${section === "matches" ? " segmented__item--active" : ""}`}
          onClick={() => setSection("matches")}
        >
          {t("play.sectionMatches")}
        </button>
      </div>

      {section === "tournaments" ? (
        <TournamentsPane filters={filters} onFiltersChange={setFilters} games={games} />
      ) : (
        <GameMatchesPane filters={filters} onFiltersChange={setFilters} games={games} />
      )}
    </div>
  );
}
