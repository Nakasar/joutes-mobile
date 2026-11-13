import { useTranslation } from "react-i18next";
import type { TournamentMatch, TournamentRound } from "../api/types";

/**
 * Arbre d'élimination d'une phase « bracket », comme sur le site : une colonne
 * par tour, un emplacement par match (ceux qui ne sont pas encore générés sont
 * « À déterminer ») et des traits qui relient chaque paire de matchs au match
 * qu'alimentent leurs vainqueurs. L'arbre défile à l'horizontale.
 */

const MATCH_W = 176;
const MATCH_H = 64;
const COL_GAP = 28;
const ROW_GAP = 14;
const HEADER_H = 40;
const BASE_SLOT = MATCH_H + ROW_GAP;

// Même comparateur que le site (`compareBracketPositions`) : les vainqueurs
// des matchs 2i et 2i+1 alimentent le match i de la colonne suivante.
const collator = new Intl.Collator("en", { numeric: true });
function sortBracketMatches(matches: TournamentMatch[]): TournamentMatch[] {
  return [...matches].sort((a, b) =>
    collator.compare(a.bracketPosition || a.id, b.bracketPosition || b.id),
  );
}

export function TournamentBracket({
  rounds,
  playerName,
  myPlayerId,
  currentRoundId,
}: {
  rounds: { round: TournamentRound; matches: TournamentMatch[] }[];
  playerName: (playerId: string) => string;
  myPlayerId?: string;
  currentRoundId?: string;
}) {
  const { t } = useTranslation();
  const sorted = [...rounds].sort((a, b) => a.round.number - b.round.number);
  const firstSlots = sorted[0]?.matches.length ?? 0;
  if (firstSlots === 0) {
    return <p className="muted">{t("tournaments.bracket.empty")}</p>;
  }

  const totalColumns = Math.max(sorted.length, Math.ceil(Math.log2(firstSlots)) + 1);
  const columns = Array.from({ length: totalColumns }, (_, c) => {
    const entry = sorted[c];
    const matches = entry ? sortBracketMatches(entry.matches) : [];
    const expected = Math.max(1, Math.ceil(firstSlots / 2 ** c));
    const slotCount = Math.max(expected, matches.length);
    return {
      round: entry?.round,
      slotCount,
      slots: Array.from({ length: slotCount }, (_, i) => matches[i] ?? null),
    };
  });

  const width = totalColumns * MATCH_W + (totalColumns - 1) * COL_GAP;
  const height = HEADER_H + firstSlots * BASE_SLOT;
  const x = (c: number) => c * (MATCH_W + COL_GAP);
  const yCenter = (c: number, i: number) => HEADER_H + BASE_SLOT * 2 ** c * (i + 0.5);

  const connectors: string[] = [];
  for (let c = 0; c < totalColumns - 1; c++) {
    const midX = x(c) + MATCH_W + COL_GAP / 2;
    for (let i = 0; i < columns[c + 1].slotCount; i++) {
      for (const child of [2 * i, 2 * i + 1]) {
        if (child >= columns[c].slotCount) continue;
        connectors.push(
          `M ${x(c) + MATCH_W} ${yCenter(c, child)} H ${midX} V ${yCenter(c + 1, i)} H ${x(c + 1)}`,
        );
      }
    }
  }

  const stageLabel = (slotCount: number, index: number) => {
    switch (slotCount) {
      case 1:
        return t("tournaments.bracket.final");
      case 2:
        return t("tournaments.bracket.semiFinals");
      case 4:
        return t("tournaments.bracket.quarterFinals");
      case 8:
        return t("tournaments.bracket.roundOf16");
      case 16:
        return t("tournaments.bracket.roundOf32");
      default:
        return t("tournaments.roundShort", { number: index + 1 });
    }
  };

  return (
    <div className="bracket-scroll">
      <div className="bracket" style={{ width, height }}>
        <svg className="bracket__lines" width={width} height={height} aria-hidden>
          {connectors.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>

        {columns.map((column, c) => (
          <div key={c}>
            <div className="bracket__header" style={{ left: x(c), width: MATCH_W }}>
              <p
                className={`bracket__stage${column.round && column.round.id === currentRoundId ? " bracket__stage--current" : ""}`}
              >
                {stageLabel(column.slotCount, c)}
              </p>
              <p className="bracket__round muted">
                {column.round
                  ? t("tournaments.roundShort", { number: column.round.number })
                  : t("tournaments.bracket.upcoming")}
              </p>
            </div>

            {column.slots.map((match, i) => {
              const style = {
                left: x(c),
                top: yCenter(c, i) - MATCH_H / 2,
                width: MATCH_W,
                height: MATCH_H,
              };
              if (!match) {
                return (
                  <div key={i} className="bracket__match bracket__match--empty" style={style}>
                    {t("tournaments.bracket.toBeDetermined")}
                  </div>
                );
              }
              const mine = myPlayerId && match.players.some((p) => p.playerId === myPlayerId);
              return (
                <div
                  key={match.id}
                  className={`bracket__match${mine ? " bracket__match--mine" : ""}`}
                  style={style}
                >
                  {match.players.map(({ playerId, score }) => {
                    const winner = match.status === "completed" && match.winnerIds.includes(playerId);
                    return (
                      <span
                        key={playerId}
                        className={`bracket__player${winner ? " bracket__player--winner" : ""}`}
                      >
                        <span className="bracket__name">{playerName(playerId)}</span>
                        {match.status !== "pending" && <span className="bracket__score">{score}</span>}
                      </span>
                    );
                  })}
                  {match.players.length === 1 && (
                    <span className="bracket__bye muted">{t("tournaments.bracket.bye")}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
