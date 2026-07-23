import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { syncTournamentKeys } from "../api/tournaments";
import type { TournamentStatus } from "../api/types";
import { ChevronIcon, PlusIcon, SwordsIcon } from "../components/icons";
import { JoinTournamentSheet } from "../components/JoinTournamentSheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { getSyncKeys } from "../lib/tournament-sync-storage";

type Filter = "current" | "past";

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

function TournamentRow({
  tournament,
}: {
  tournament: { id: string; name: string; status: TournamentStatus };
}) {
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
  const [filter, setFilter] = useState<Filter>("current");
  const [joining, setJoining] = useState(false);

  const { data, loading, error, reload } = useApi(() =>
    syncTournamentKeys(Object.values(getSyncKeys())),
  );

  const tournaments = data?.map((entry) => entry.tournament) ?? [];
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
