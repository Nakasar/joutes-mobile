import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { PlayGame } from "../api/play";
import { config } from "../config";
import type { BotLevel } from "../engine/types";
import { historyId, recordGame, strongestLevel, type PlayHistoryEntry, type RecordOutcome, type SoloMeta } from "./history";
import { ShareIcon, TrophyIcon } from "./icons";
import { usePlayT } from "./t";
import { useToast } from "./ui";

const GAME_NAMES: Record<PlayGame, string> = { riftbound: "Riftbound", swu: "Star Wars: Unlimited" };

/** Ce que la table sait de la partie qui vient de finir. */
export type FinishedGame = {
  game: PlayGame;
  seed: number;
  /** Mon siège, ou `null` pour un match IA contre IA. */
  seat: number | null;
  bots: (BotLevel | null)[];
  meta?: SoloMeta;
  /** Les sièges gagnants ; vide pour une partie nulle. */
  winners: number[];
  /** Le tour (Riftbound) ou le round (SWU). */
  turn: number;
  /** Mes points et ceux du meilleur adversaire, ou les PV restants des bases. */
  score: [number, number] | null;
  /** Le code moteur de ma légende (mon leader à SWU). */
  legend: string | null;
  /** Une partie nulle à SWU : les deux bases tombent ensemble. */
  draw?: boolean;
};

type Props = {
  finished: FinishedGame;
  onReplay: () => void;
  onChangeDeck: () => void;
};

/**
 * L'écran de fin d'une partie contre l'IA : le score, ce que la partie change
 * (un palier conquis, une série) et de quoi rejouer tout de suite. La partie
 * est comptée dans l'historique une seule fois, à la première ouverture.
 */
export function GameOver({ finished, onReplay, onChangeDeck }: Props) {
  const { t } = useTranslation();
  const tp = usePlayT("Play");
  const { toast, node: toastNode } = useToast();
  const [open, setOpen] = useState(true);

  const { game, seat, meta, winners, turn, score } = finished;
  const watching = seat === null;
  const level = strongestLevel(finished.bots);
  const levelName = tp(`level.${level}`);
  const outcome: PlayHistoryEntry["outcome"] =
    finished.draw || winners.length === 0 ? "draw" : seat !== null && winners.includes(seat) ? "won" : "lost";

  // Compter la partie (une seule fois, même si l'écran se rouvre).
  const recorded = useMemo<RecordOutcome | null>(() => {
    if (watching) return null;
    return recordGame({
      id: historyId(game, finished.seed),
      game,
      at: Date.now(),
      startedAt: meta?.startedAt,
      level,
      outcome,
      deckName: meta?.deckName ?? GAME_NAMES[game],
      legend: finished.legend,
      image: meta?.image,
      score: score ?? undefined,
      turns: turn,
    });
    // La partie finie ne change plus : une seule fois par graine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, finished.seed]);

  const minutes = meta?.startedAt ? Math.max(1, Math.round((Date.now() - meta.startedAt) / 60_000)) : null;
  const deck = meta?.deckName ?? GAME_NAMES[game];

  const share = async () => {
    const text = t(outcome === "won" ? "playHub.over.shareWon" : "playHub.over.shareOther", {
      level: levelName,
      game: GAME_NAMES[game],
      deck,
    });
    const url = `${config.webUrl}/games/${game}/play`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ text, url });
        return;
      } catch {
        // Partage annulé : on copie le texte.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast(tp("room.copied"));
    } catch {
      // Ni partage ni presse-papiers : rien à faire.
    }
  };

  if (!open) {
    return (
      <button type="button" className="pt-btn pt-btn--grad" onClick={() => setOpen(true)}>
        {t(`playHub.over.${watching ? "watched" : outcome}`)}
      </button>
    );
  }

  const title = t(`playHub.over.${watching ? "watched" : outcome}`);
  const highlight =
    recorded?.firstAtLevel && outcome === "won"
      ? { title: t("playHub.over.levelConquered", { level: levelName }), hint: t("playHub.over.levelConqueredHint", { level: levelName, deck }) }
      : outcome === "won" && recorded && recorded.streak >= 2
        ? { title: t("playHub.over.streakTitle", { count: recorded.streak }), hint: t("playHub.over.streakHint") }
        : outcome === "lost"
          ? { title: null, hint: t("playHub.over.lostHint", { level: levelName }) }
          : null;

  return createPortal(
    <div className={`over over--${watching ? "watched" : outcome}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="over__inner">
        <p className="over__game">
          {t(game === "swu" ? "playHub.over.round" : "playHub.over.turn", { game: GAME_NAMES[game], turn })}
        </p>
        <h1 className="over__title">{title}</h1>

        <div className="over__duel">
          <div className={`over__side${outcome === "lost" ? " over__side--dim" : ""}`}>
            {meta?.image ? <img src={meta.image} alt="" className="over__art over__art--me" /> : <span className="over__art over__art--empty" />}
            <span className="over__name">{watching ? (meta?.deckName ?? "") : t("playHub.over.you")}</span>
          </div>
          {score && (
            <div className="over__score">
              <span>
                {score[0]}
                <small> – {score[1]}</small>
              </span>
              <span className="over__unit">{t(game === "swu" ? "playHub.over.hp" : "playHub.over.points")}</span>
            </div>
          )}
          <div className={`over__side${outcome === "won" ? " over__side--dim" : ""}`}>
            {meta?.opponentImage ? (
              <img src={meta.opponentImage} alt="" className="over__art over__art--them" />
            ) : (
              <span className="over__art over__art--empty" />
            )}
            <span className="over__name">{t("playHub.over.aiLevel", { level: levelName })}</span>
          </div>
        </div>

        {highlight && (
          <div className={`over__badge${highlight.title ? "" : " over__badge--soft"}`}>
            {highlight.title && (
              <span className="over__badge-icon">
                <TrophyIcon size={22} />
              </span>
            )}
            <div className="over__badge-text">
              {highlight.title && <p className="over__badge-title">{highlight.title}</p>}
              <p className="over__badge-hint">{highlight.hint}</p>
            </div>
          </div>
        )}

        {!watching && (
          <div className="over__stats">
            <div>
              <b className="over__stat--hot">{recorded?.streak ?? 0}</b>
              <span>{t("playHub.over.statStreak")}</span>
            </div>
            <div>
              <b>{turn}</b>
              <span>{t(game === "swu" ? "playHub.over.statRounds" : "playHub.over.statTurns")}</span>
            </div>
            <div>
              <b>{minutes !== null ? t("playHub.over.minutes", { count: minutes }) : "—"}</b>
              <span>{t("playHub.over.statTime")}</span>
            </div>
          </div>
        )}
        {recorded && recorded.deckGames >= 2 && (
          <p className="over__record">
            {t("playHub.over.deckRecord", { deck, count: recorded.deckWins, games: recorded.deckGames })}
          </p>
        )}

        <div className="over__actions">
          <button type="button" className="over__primary" onClick={onReplay}>
            {t("playHub.over.replay")}
          </button>
          <div className="over__row">
            <button type="button" className="over__secondary" onClick={onChangeDeck}>
              {t("playHub.over.changeDeck")}
            </button>
            <button type="button" className="over__secondary" onClick={() => void share()}>
              <ShareIcon size={16} />
              {t("playHub.over.share")}
            </button>
          </div>
          <button type="button" className="over__link" onClick={() => setOpen(false)}>
            {t("playHub.over.seeTable")}
          </button>
        </div>
      </div>
      {toastNode}
    </div>,
    document.body,
  );
}
