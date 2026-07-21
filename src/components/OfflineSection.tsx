import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listGames } from "../api/games";
import type { GameSummary, OfflineMeta } from "../api/types";
import { downloadGameData } from "../lib/offline-download";
import { deleteExport, listMeta } from "../lib/offline-store";
import { currentLocale } from "../i18n";
import { DeckCheckIcon } from "./icons";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type State =
  | { status: "idle" }
  | { status: "downloading" }
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
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: "idle" });

  async function download() {
    setState({ status: "downloading" });
    try {
      await downloadGameData(game.slug, game.name);
      setState({ status: "idle" });
      onChanged();
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : t("offline.error"),
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
          <p className="offline-row__sub">{t("offline.downloading")}</p>
        ) : meta ? (
          <p className="offline-row__sub">
            {t("offline.upToDate", {
              size: formatSize(meta.size),
              date: formatDate(meta.generatedAt),
            })}
          </p>
        ) : state.status === "error" ? (
          <p className="offline-row__sub offline-row__sub--error">
            {state.message}
          </p>
        ) : (
          <p className="offline-row__sub">{t("offline.notDownloaded")}</p>
        )}
        {downloading && (
          <div className="progress progress--indeterminate" style={{ marginTop: 6 }}>
            <div className="progress__bar" />
          </div>
        )}
      </div>

      <div className="offline-row__actions">
        {meta && !downloading && (
          <button
            className="icon-button"
            onClick={remove}
            aria-label={t("offline.delete")}
            title={t("offline.deleteShort")}
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
            t("offline.inProgress")
          ) : meta ? (
            t("offline.update")
          ) : (
            <>
              <DeckCheckIcon size={16} />
              {t("offline.download")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function OfflineSection() {
  const { t } = useTranslation();
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
      <h2 className="card__title">{t("offline.title")}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
        {t("offline.description")}
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
          {t("offline.total", { size: formatSize(totalSize) })}
        </p>
      )}
    </section>
  );
}
