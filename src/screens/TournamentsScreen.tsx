import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listPlayingTournaments, syncTournamentKeys } from "../api/tournaments";
import type { TournamentStatus } from "../api/types";
import { ChevronIcon, PlusIcon, SwordsIcon } from "../components/icons";
import { JoinTournamentSheet } from "../components/JoinTournamentSheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { getSyncKeys } from "../lib/tournament-sync-storage";
import { useAuth } from "../store/auth";

type Filter = "current" | "past";

interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
}

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

/**
 * Combine les tournois où le compte connecté est inscrit (`/tournaments/playing`,
 * source d'autorité) avec ceux rejoints comme invité et stockés localement
 * (`/tournaments/sync`) — un même appareil peut avoir les deux.
 */
function loadTournaments(isAuthenticated: boolean): Promise<TournamentSummary[]> {
  const playing = isAuthenticated ? listPlayingTournaments() : Promise.resolve([]);
  const synced = syncTournamentKeys(Object.values(getSyncKeys()));

  return Promise.allSettled([playing, synced]).then(([playingResult, syncedResult]) => {
    // `/tournaments/playing` fait autorité pour un compte connecté (401,
    // panne réseau...) : on ne l'avale pas en liste vide, sous peine
    // d'afficher un état "aucun tournoi" trompeur.
    if (playingResult.status === "rejected") throw playingResult.reason;
    // La synchronisation invité est secondaire (best-effort) tant que le
    // compte a lui-même des résultats ; sinon son échec devient la seule
    // explication de la liste vide et doit remonter.
    if (syncedResult.status === "rejected" && playingResult.value.length === 0) {
      throw syncedResult.reason;
    }

    const byId = new Map<string, TournamentSummary>();
    if (syncedResult.status === "fulfilled") {
      for (const entry of syncedResult.value) {
        byId.set(entry.tournament.id, entry.tournament);
      }
    }
    for (const entry of playingResult.value) {
      byId.set(entry.tournament.id, entry.tournament);
    }
    return Array.from(byId.values());
  });
}

function TournamentRow({ tournament }: { tournament: TournamentSummary }) {
  const { t } = useTranslation();
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
        </p>
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}

export function TournamentsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<Filter>("current");
  const [joining, setJoining] = useState(false);

  const { data, loading, error, reload } = useApi(() => loadTournaments(isAuthenticated), [isAuthenticated]);

  const tournaments = data ?? [];
  const filtered = tournaments.filter((tournament) =>
    filter === "past" ? tournament.status === "completed" : tournament.status !== "completed",
  );

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="screen-head__titles">
          <h1 className="screen-title">{t("tournaments.title")}</h1>
        </div>
      </div>

      <button
        className="btn btn--grad btn--block"
        style={{ marginBottom: 16 }}
        onClick={() => setJoining(true)}
      >
        <PlusIcon size={18} />
        {t("tournaments.joinAction")}
      </button>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button
          className={`segmented__item${filter === "current" ? " segmented__item--active" : ""}`}
          onClick={() => setFilter("current")}
        >
          {t("tournaments.filterCurrent")}
        </button>
        <button
          className={`segmented__item${filter === "past" ? " segmented__item--active" : ""}`}
          onClick={() => setFilter("past")}
        >
          {t("tournaments.filterPast")}
        </button>
      </div>

      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={data && filtered.length === 0 ? t("tournaments.empty") : undefined}
      />

      {filtered.map((tournament) => (
        <TournamentRow key={tournament.id} tournament={tournament} />
      ))}

      {joining && (
        <JoinTournamentSheet
          onClose={() => setJoining(false)}
          onJoined={(tournamentId) => navigate(`/tournaments/${tournamentId}`)}
        />
      )}
    </div>
  );
}
