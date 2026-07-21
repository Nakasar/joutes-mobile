import { useCallback, useEffect, useState } from "react";
import { listGames } from "../api/games";
import type { GameSummary, OfflineMeta } from "../api/types";
import { downloadGameData } from "../lib/offline-download";
import { deleteExport, listMeta } from "../lib/offline-store";
import { DeckCheckIcon } from "./icons";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type State =
  | { status: "idle" }
  | { status: "downloading"; pct: number }
  | { status: "error"; message: string };

function GameRow({
  game,
  meta,
  onChanged,
}: {
  game: GameSummary;
  meta?: OfflineMeta;
  onChanged: () => void;
}) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function download() {
    setState({ status: "downloading", pct: 0 });
    try {
      await downloadGameData(game.slug, game.name, ({ loaded, total }) => {
        setState({
          status: "downloading",
          pct: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
        });
      });
      setState({ status: "idle" });
      onChanged();
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Téléchargement impossible.",
      });
    }
  }

  async function remove() {
    await deleteExport(game.slug);
    onChanged();
  }

  const downloading = state.status === "downloading";

  return (
    <div className="offline-row">
      <div className="offline-row__body">
        <p className="offline-row__name">{game.name}</p>
        {downloading ? (
          <p className="offline-row__sub">Téléchargement… {state.pct}%</p>
        ) : meta ? (
          <p className="offline-row__sub">
            {formatSize(meta.size)} · à jour le {formatDate(meta.generatedAt)}
          </p>
        ) : state.status === "error" ? (
          <p className="offline-row__sub offline-row__sub--error">
            {state.message}
          </p>
        ) : (
          <p className="offline-row__sub">Non téléchargé</p>
        )}
        {downloading && (
          <div className="progress" style={{ marginTop: 6 }}>
            <div className="progress__bar" style={{ width: `${state.pct}%` }} />
          </div>
        )}
      </div>

      <div className="offline-row__actions">
        {meta && !downloading && (
          <button
            className="icon-button"
            onClick={remove}
            aria-label="Supprimer les données hors ligne"
            title="Supprimer"
          >
            🗑
          </button>
        )}
        <button
          className="btn btn--outline offline-row__btn"
          onClick={download}
          disabled={downloading}
        >
          {downloading ? (
            `${state.pct}%`
          ) : meta ? (
            "Mettre à jour"
          ) : (
            <>
              <DeckCheckIcon size={16} />
              Télécharger
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function OfflineSection() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [metaBySlug, setMetaBySlug] = useState<Record<string, OfflineMeta>>({});

  const refreshMeta = useCallback(() => {
    listMeta().then((all) => {
      setMetaBySlug(Object.fromEntries(all.map((m) => [m.slug, m])));
    });
  }, []);

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch(() => {
        /* liste indisponible hors ligne : on garde les jeux déjà téléchargés */
      });
    refreshMeta();
  }, [refreshMeta]);

  // Jeux à afficher : la liste en ligne, ou à défaut les jeux déjà téléchargés.
  const rows: GameSummary[] =
    games.length > 0
      ? games
      : Object.values(metaBySlug).map((m) => ({
          _id: m.slug,
          slug: m.slug,
          name: m.name,
        }));

  const totalSize = Object.values(metaBySlug).reduce(
    (sum, m) => sum + m.size,
    0,
  );

  return (
    <section className="card">
      <h2 className="card__title">Hors ligne</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
        Téléchargez les règles (FR/EN), les cartes et les erratas d'un jeu pour
        les consulter sans connexion.
      </p>
      {rows.map((game) => (
        <GameRow
          key={game.slug}
          game={game}
          meta={metaBySlug[game.slug]}
          onChanged={refreshMeta}
        />
      ))}
      {totalSize > 0 && (
        <p className="offline-total muted">
          Total téléchargé : {formatSize(totalSize)}
        </p>
      )}
    </section>
  );
}
