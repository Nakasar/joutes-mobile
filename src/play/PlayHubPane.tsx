import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getGame, listGames } from "../api/games";
import { PLAY_GAMES, type PlayGame } from "../api/play";
import { listPlayingTournamentsPage } from "../api/tournaments";
import type { Game } from "../api/types";
import { ChevronIcon, PlusIcon, ScanIcon, SwordsIcon } from "../components/icons";
import { JoinPlaySheet } from "../components/JoinPlaySheet";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import { currentLocale } from "../i18n";
import { useAuth } from "../store/auth";
import type { EngineRecord } from "../engine/types";
import type { SwuRecord } from "../engine/swu/types";
import { BOT_LEVELS } from "../engine/types";
import { historyStats, isRecorded, readHistory, readLastSetup, strongestLevel, type LastSetup } from "./history";
import { CheckIcon, PlayIcon, TrophyIcon } from "./icons";
import { peekRiftbound, peekSwu, type SavePeek } from "./peek";
import { readSwuSave, writeSwuSave, type SwuSave } from "./swu/useSwuSoloGame";
import { usePlayT } from "./t";
import { readSoloSave, writeSoloSave, type SoloSave } from "./useSoloGame";

const GAME_NAMES: Record<PlayGame, string> = { riftbound: "Riftbound", swu: "Star Wars: Unlimited" };

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

/** La partie gardée d'un jeu, si elle n'est pas finie (une partie finie est dans l'historique). */
function pendingSave(game: PlayGame): SoloSave | SwuSave | null {
  const save = game === "swu" ? readSwuSave() : readSoloSave();
  return save && !isRecorded(game, save.record.seed) ? save : null;
}

type Resume = { game: PlayGame; save: SoloSave | SwuSave; peek: SavePeek | null };

/**
 * Le volet « Jouer » de l'onglet Jouer : la partie en cours, une partie rapide
 * par jeu, les paliers battus contre l'IA et les parties avec d'autres joueurs.
 */
export function PlayHubPane() {
  const { t } = useTranslation();
  const tp = usePlayT("Play");
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [joining, setJoining] = useState(false);

  const { data, loading, error, reload } = useApi(async () => {
    const catalog = await listGames();
    const candidates = catalog.filter((game) => (PLAY_GAMES as readonly string[]).includes(game.slug));
    // La liste des jeux ne porte pas les fonctionnalités : la fiche de chacun, si.
    const details = await Promise.all(candidates.map((game) => getGame(game.slug).catch(() => null)));
    return details.filter((game): game is Game => game?.features?.play === true);
  }, []);
  const games = data ?? [];

  const stats = useMemo(() => historyStats(readHistory()), []);
  const pending = useMemo(
    () => ({ riftbound: pendingSave("riftbound"), swu: pendingSave("swu") }) as Record<PlayGame, SoloSave | SwuSave | null>,
    [],
  );
  const last = useMemo(
    () => ({ riftbound: readLastSetup<EngineRecord>("riftbound"), swu: readLastSetup<SwuRecord>("swu") }),
    [],
  );

  // Où en est la partie en cours : le moteur la rejoue sans l'ouvrir.
  const [resumes, setResumes] = useState<Resume[]>(() =>
    (Object.keys(pending) as PlayGame[]).flatMap((game) => (pending[game] ? [{ game, save: pending[game]!, peek: null }] : [])),
  );
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      resumes.map(async (resume) => ({
        ...resume,
        peek:
          resume.game === "swu" ? await peekSwu(resume.save as SwuSave) : await peekRiftbound(resume.save as SoloSave),
      })),
    ).then((next) => {
      if (!cancelled) setResumes(next.filter((resume) => !resume.peek?.finished));
    });
    return () => {
      cancelled = true;
    };
    // Une seule fois, à l'ouverture de l'onglet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tournament } = useApi(async () => {
    if (!isAuthenticated) return null;
    const page = await listPlayingTournamentsPage({ page: 1, limit: 5, statuses: ["draft", "in-progress"] });
    const now = Date.now();
    return (
      page.tournaments
        .map((entry) => entry.tournament)
        .filter((item) => item.status === "in-progress" || (item.startsAt && Date.parse(item.startsAt) > now - 6 * 3600_000))
        .sort((a, b) => Date.parse(a.startsAt ?? "") - Date.parse(b.startsAt ?? ""))[0] ?? null
    );
  }, [isAuthenticated]);

  const quickPlay = (game: PlayGame, setup: LastSetup<EngineRecord> | LastSetup<SwuRecord>) => {
    const meta = { ...setup.meta, startedAt: Date.now() };
    if (game === "swu") {
      const record = setup.record as SwuRecord;
      writeSwuSave({ seat: 0, bots: setup.bots, meta, record: { ...record, seed: newSeed(), actions: [] } });
    } else {
      const record = setup.record as EngineRecord;
      writeSoloSave({ seat: 0, bots: setup.bots, meta, record: { ...record, seed: newSeed(), actions: [] } });
    }
    navigate(`/play/${game}/solo`);
  };

  const levelName = (level: (typeof BOT_LEVELS)[number]) => tp(`level.${level}`);
  const beatenAny = BOT_LEVELS.some((level) => stats.winsByLevel[level] > 0);

  return (
    <div className="hub">
      {resumes.map(({ game, save, peek }) => {
        const watching = save.seat === null;
        const level = levelName(strongestLevel(save.bots));
        const image = save.meta?.image ?? save.meta?.opponentImage;
        return (
          <Link key={game} to={`/play/${game}/solo`} className="hub-resume">
            {image && <img className="hub-resume__art" src={image} alt="" />}
            <span className="hub-resume__shade" aria-hidden />
            <span className="hub-resume__body">
              <span className="hub-resume__badge">{watching ? t("playHub.watchBadge") : t("playHub.resumeBadge")}</span>
              <span className="hub-resume__title">
                {watching
                  ? t("playHub.watchTitle", { players: save.record.config.players.map((player) => player.name).join(" · ") })
                  : t("playHub.resumeTitle", { deck: save.meta?.deckName ?? GAME_NAMES[game], level })}
              </span>
              <span className="hub-resume__sub">
                {peek
                  ? [
                      t(game === "swu" ? "playHub.resumeRound" : "playHub.resumeTurn", { game: GAME_NAMES[game], turn: Math.max(1, peek.turn) }),
                      watching ? null : peek.myMove ? t("playHub.yourMove") : t("playHub.aiMove"),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : GAME_NAMES[game]}
              </span>
              <span className="hub-resume__foot">
                {peek?.score && (
                  <span className="hub-resume__score">
                    {peek.score[0]}
                    <small> – {peek.score[1]}</small>
                  </span>
                )}
                {peek?.score && peek.max ? (
                  <span className="hub-resume__pips" aria-hidden>
                    {Array.from({ length: peek.max }, (_, index) => (
                      <span key={index} className={index < peek.score![0] ? "hub-resume__pip--on" : undefined} />
                    ))}
                  </span>
                ) : (
                  <span className="pt-grow" />
                )}
                <span className="hub-resume__cta">{t("playHub.resume")}</span>
              </span>
            </span>
          </Link>
        );
      })}

      <h2 className="hub-title">{t("playHub.launchTitle")}</h2>
      <div className="hub-games">
        {games.map((game) => {
          const slug = game.slug as PlayGame;
          const setup = last[slug];
          const inProgress = pending[slug] !== null;
          const art = setup?.meta.image ?? game.images?.vertical ?? game.images?.banner ?? game.banner;
          return (
            <div key={slug} className="hub-game" style={art ? ({ "--art": `url("${art}")` } as CSSProperties) : undefined}>
              <Link to={`/play/${slug}`} className="hub-game__link" aria-label={game.name} />
              {!art && game.icon && <img className="hub-game__icon" src={game.icon} alt="" />}
              <span className="hub-game__body">
                <span className="hub-game__name">{game.name}</span>
                <span className="hub-game__sub">
                  {setup
                    ? t("playHub.quickSub", { deck: setup.meta.deckName ?? "", level: levelName(strongestLevel(setup.bots)) })
                    : t("playHub.firstSub")}
                </span>
                {inProgress ? (
                  <Link to={`/play/${slug}/solo`} className="hub-game__cta">
                    <PlayIcon size={14} />
                    {t("playHub.resume")}
                  </Link>
                ) : setup ? (
                  <button type="button" className="hub-game__cta" onClick={() => quickPlay(slug, setup)}>
                    <PlayIcon size={14} />
                    {t("playHub.quickPlay")}
                  </button>
                ) : (
                  <Link to={`/play/${slug}`} className="hub-game__cta">
                    {t("playHub.chooseDeck")}
                  </Link>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <StatusView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!loading && !error && games.length === 0 ? t("play.tableEmpty") : undefined}
      />
      {games.length > 0 && <p className="muted hub-note">{t("playHub.quickHint")}</p>}

      <h2 className="hub-title">{t("playHub.levelsTitle")}</h2>
      <div className="hub-levels">
        <div className="hub-levels__row">
          {BOT_LEVELS.map((level) => {
            const wins = stats.winsByLevel[level];
            return (
              <div key={level} className={`hub-level${wins > 0 ? " hub-level--done" : " hub-level--todo"}`}>
                <span className="hub-level__mark">{wins > 0 ? <CheckIcon size={18} /> : <TrophyIcon size={18} />}</span>
                <b>{levelName(level)}</b>
                <span className="hub-level__count">
                  {wins > 0 ? t("playHub.levelWins", { count: wins }) : t("playHub.levelToConquer")}
                </span>
              </div>
            );
          })}
        </div>
        {stats.bestDeck ? (
          <div className="hub-best">
            {stats.bestDeck.image && <img src={stats.bestDeck.image} alt="" />}
            <span className="play-deck__body">
              <b>{t("playHub.bestDeck", { deck: stats.bestDeck.deckName })}</b>
              <span className="muted play-small">
                {t("playHub.bestDeckStats", {
                  count: stats.bestDeck.wins,
                  games: stats.bestDeck.games,
                  rate: Math.round((stats.bestDeck.wins / stats.bestDeck.games) * 100),
                })}
              </span>
            </span>
          </div>
        ) : (
          !beatenAny && <p className="muted play-small hub-levels__empty">{t("playHub.levelsEmpty")}</p>
        )}
      </div>

      <h2 className="hub-title">{t("playHub.othersTitle")}</h2>
      <div className="hub-others">
        <div className="hub-actions">
          <Link to={games[0] ? `/play/${games[0].slug}?way=online` : "/play"} className="hub-action">
            <PlusIcon size={18} />
            {t("playHub.createTable")}
          </Link>
          <button type="button" className="hub-action" onClick={() => setJoining(true)}>
            <ScanIcon size={18} />
            {t("playHub.scan")}
          </button>
        </div>
        {tournament && (
          <Link to={`/tournaments/${tournament.id}`} className="hub-tournament">
            <span className="hub-tournament__icon">
              <SwordsIcon size={20} />
            </span>
            <span className="play-deck__body">
              <b>
                {tournament.name}
                {tournament.startsAt &&
                  ` · ${new Date(tournament.startsAt).toLocaleString(currentLocale(), {
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
              </b>
              <span className="muted play-small">{t("playHub.nextTournament")}</span>
            </span>
            <ChevronIcon size={18} />
          </Link>
        )}
      </div>

      {joining && (
        <JoinPlaySheet
          onClose={() => setJoining(false)}
          onJoinedTournament={(tournamentId) => navigate(`/tournaments/${tournamentId}`)}
          onJoinedMatch={(matchId) => navigate(`/game-matches/${matchId}`)}
        />
      )}
    </div>
  );
}
