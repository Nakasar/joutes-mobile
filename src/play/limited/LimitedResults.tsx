import type { ReactNode } from "react";

import { matchOf, type LimitedView } from "../../engine/limited";
import { TrophyIcon } from "../icons";
import { usePlayT } from "../t";

/** Le bilan de l'évènement : mon match, ceux des autres tables, et le deck joué. */
export function LimitedResults({
  view,
  seat,
  deck,
  onReplay,
  onLeave,
}: {
  view: LimitedView<unknown>;
  seat: number;
  /** Le deck joué, tel que le jeu le résume (`LimitedKit.DeckSummary`). */
  deck?: ReactNode;
  onReplay?: () => void;
  onLeave: () => void;
}) {
  const t = usePlayT("Limited");
  const mine = matchOf(view, seat);
  const nameOf = (index: number) => view.seats[index]?.name ?? "?";
  // Un siège négatif : un spectateur, qui n'a ni match ni deck.
  const outcome =
    seat < 0
      ? view.phase === "done"
        ? "over"
        : "pending"
      : !mine
        ? "bye"
        : !mine.match.done
          ? "pending"
          : mine.match.winner === null
            ? "draw"
            : mine.match.winner === seat
              ? "won"
              : "lost";
  const opponent = mine ? nameOf(mine.match.seats.find((other) => other !== seat) ?? -1) : "";

  return (
    <div className="lim-two">
      <div className="lim-build__side">
        <section className="lim-panel">
          <h2 className="lim-outcome">
            {outcome === "won" && <TrophyIcon size={24} />}
            {t(`results.${outcome}`)}
          </h2>
          {mine && <p className="muted">{t("results.against", { name: opponent })}</p>}
          <div className="lim-row">
            {onReplay && (
              <button type="button" className="btn btn--outline" onClick={onReplay}>
                {t("results.replay")}
              </button>
            )}
            <button type="button" className="btn btn--grad" onClick={onLeave}>
              {t("results.leave")}
            </button>
          </div>
          {onReplay && <p className="muted lim-small">{t("results.replayHint")}</p>}
        </section>

        {(view.matches.length > 1 || (seat < 0 && view.matches.length > 0)) && (
          <section className="lim-panel">
            <h2 className="lim-title">{t("results.tables")}</h2>
            <ul className="lim-list">
              {view.matches.map((match, index) => (
                <li key={index} className="lim-table">
                  <span className="muted">{t("results.table", { number: index + 1 })}</span>
                  <span className="lim-table__who">
                    {match.seats.map((player, place) => {
                      const name = player === seat ? <u>{nameOf(player)}</u> : nameOf(player);
                      return (
                        <span key={player}>
                          {place > 0 && <span className="muted"> · </span>}
                          {match.done && match.winner === player ? <b>{name}</b> : name}
                        </span>
                      );
                    })}
                  </span>
                  <span className="muted" role="status">
                    {!match.done
                      ? t("results.playing")
                      : match.winner === null
                        ? t("results.tableDraw")
                        : t("results.tableWon", { name: nameOf(match.winner) })}
                  </span>
                </li>
              ))}
            </ul>
            {view.bye !== null && <p className="muted lim-small">{t("results.byeOf", { name: nameOf(view.bye) })}</p>}
          </section>
        )}
      </div>

      {deck && <aside className="lim-panel">{deck}</aside>}
    </div>
  );
}
