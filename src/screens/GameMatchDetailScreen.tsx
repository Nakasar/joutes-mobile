import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getGameMatch } from "../api/game-matches";
import type { BattleReportArmy, GameMatchPlayer } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { BattleMapPanel } from "../components/BattleMapPanel";
import { StatusView } from "../components/StatusView";
import { PinIcon, TrophyIcon } from "../components/icons";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { useAuth } from "../store/auth";

function formatPlayedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlayerRow({ player }: { player: GameMatchPlayer }) {
  const { t } = useTranslation();

  return (
    <div className="list-row">
      <div className="list-row__body">
        <p className="list-row__title">
          {player.username}
          {player.isGuest && (
            <span className="muted"> · {t("gameMatches.guest")}</span>
          )}
        </p>
      </div>
      {player.isWinner && (
        <span className="chip chip--grad">
          <TrophyIcon size={12} />
          {t("gameMatches.winner")}
        </span>
      )}
    </div>
  );
}

function ArmySection({
  player,
  army,
}: {
  player: GameMatchPlayer | undefined;
  army: BattleReportArmy;
}) {
  const { t } = useTranslation();
  const units = army.units ?? [];
  if (units.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Pas de `list-row__*` ici : ces classes coupent le texte à la ligne,
          ce qui conviendrait mal à un nom de figurine — une liste d'armée se
          lit en entier ou ne se lit pas. */}
      <p className="army-list__owner">
        {player?.username ?? t("gameMatches.unknownPlayer")}
        {army.name ? ` · ${army.name}` : ""}
      </p>
      {units.map((unit, index) => (
        <p key={`${unit.productId ?? unit.name}-${index}`} className="army-list__unit">
          {unit.quantity > 1 ? `${unit.quantity} × ` : ""}
          {unit.name}
        </p>
      ))}
    </div>
  );
}

/**
 * Fiche d'une partie jouée hors tournoi.
 *
 * Le récit se lit ici, et la table de jeu s'y tient : ses instants se
 * consultent, et le créateur les édite — c'est en cours de partie, la table
 * devant soi, qu'on note où en sont les figurines, et c'est là qu'on a un
 * téléphone en main plutôt qu'un ordinateur. Le reste du rapport (scénario,
 * notes, listes d'armée) se compose toujours sur le web.
 */
export function GameMatchDetailScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { matchId } = useParams<{ matchId: string }>();
  const { data, loading, error, reload } = useApi(
    () => getGameMatch(matchId ?? ""),
    [matchId],
  );

  const players = data?.players ?? [];
  const armies = Object.entries(data?.battleReport?.armies ?? {});

  return (
    <div className="screen">
      <BackHeader title={data?.game?.name ?? t("gameMatches.detailTitle")} />

      <StatusView loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <p className="muted">{formatPlayedAt(data.playedAt)}</p>
          {data.lair && (
            <p className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <PinIcon size={16} />
              {data.lair.name}
            </p>
          )}

          <h2 className="section-title">
            {t("gameMatches.playersCount", { count: players.length })}
          </h2>
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}

          {data.battleReport?.scenario && (
            <>
              <h2 className="section-title">{t("gameMatches.scenarioLabel")}</h2>
              <p>{data.battleReport.scenario}</p>
            </>
          )}

          {armies.length > 0 && (
            <>
              <h2 className="section-title">{t("gameMatches.armiesLabel")}</h2>
              {armies.map(([playerId, army]) => (
                <ArmySection
                  key={playerId}
                  player={players.find((player) => player.id === playerId)}
                  army={army}
                />
              ))}
            </>
          )}

          {data.battleReport && (
            <>
              <h2 className="section-title">{t("battleMap.title")}</h2>
              <BattleMapPanel
                // Remonter la table du serveur à chaque chargement : le panneau
                // tient son propre état, il ne doit pas repartir d'une table
                // périmée si la fiche a été rechargée entre-temps.
                key={`${data.id}-${data.battleReport.map?.snapshots.length ?? 0}`}
                matchId={data.id}
                gameSlug={data.game?.slug ?? undefined}
                players={players}
                armies={data.battleReport.armies ?? {}}
                map={data.battleReport.map}
                editable={Boolean(user && data.createdBy === user.id)}
              />
            </>
          )}

          {data.battleReport?.notes && (
            <>
              <h2 className="section-title">{t("gameMatches.notesLabel")}</h2>
              {/* Notes saisies au fil de la partie : les retours à la ligne en
                  font la structure, ils doivent être conservés. */}
              <p style={{ whiteSpace: "pre-wrap" }}>{data.battleReport.notes}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
