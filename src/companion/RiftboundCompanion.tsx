import { useState } from "react";
import { useTranslations } from "./i18n";
import { Dices, Menu, Minus, Plus, Timer, Undo2, X } from "./icons";

import {
  LEGACY_TRACKER_KEY,
  adjustRiftboundCounter,
  cycleRiftboundControl,
  displayName,
  drawBattlefields,
  drawFirstPlayer,
  endRiftboundTurn,
  fromLegacyTracker,
  newRiftbound,
  rematchRiftbound,
  riftboundFieldsInPlay,
  riftboundTarget,
  scoreRiftbound,
  setRiftboundMode,
  setRiftboundPlayerCount,
  startRiftbound,
  updateRiftboundPlayer,
  type RiftboundMode,
  type RiftboundState,
} from "./state";
import { cn } from "./cn";

import {
  CardSearch,
  CardThumb,
  CompanionTable,
  DeckSelect,
  GameMenu,
  LastEvent,
  LookupButton,
  companionFonts,
  useCompanion,
  useCompanionDecks,
  useLockedScroll,
  useWakeLock,
} from "./shared";

function readLegacy(): RiftboundState | null {
  try {
    const raw = localStorage.getItem(LEGACY_TRACKER_KEY);
    return raw ? fromLegacyTracker(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

const MODES: RiftboundMode[] = ["duel", "teams", "melee"];

/** Le compagnon de Riftbound : préparation, table, victoire. */
export function RiftboundCompanion() {
  const t = useTranslations("Games.Companion");
  const { state, canUndo, hydrated, play, edit, undo, reset } = useCompanion("riftbound", () => newRiftbound(), readLegacy);
  const decks = useCompanionDecks("riftbound");
  const [atTable, setAtTable] = useState(true);
  const [menu, setMenu] = useState(false);

  const showTable = hydrated && state.phase !== "setup" && atTable;
  useWakeLock(showTable);
  useLockedScroll(showTable);

  if (!showTable) {
    return (
      <div className={cn("cmp cmp-rb", companionFonts)}>
        <div className="cmp-setup">
          {state.phase !== "setup" && (
            <button type="button" className="cmp-button w-full" onClick={() => setAtTable(true)}>
              {t("resume")}
            </button>
          )}
          <div className="cmp-segments" role="group" aria-label={t("mode")}>
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className="cmp-segment"
                aria-pressed={state.mode === mode}
                onClick={() => edit((s) => setRiftboundMode(s, mode))}
                disabled={state.phase !== "setup"}
              >
                {t(`rb.mode.${mode}`)}
                <small>{t(`rb.modeHint.${mode}`)}</small>
              </button>
            ))}
          </div>
          {state.mode === "melee" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="cmp-label">{t("players")}</span>
              {[3, 4].map((n) => (
                <button key={n} type="button" className="cmp-button" aria-pressed={state.players.length === n} onClick={() => edit((s) => setRiftboundPlayerCount(s, n))}>
                  {n}
                </button>
              ))}
            </div>
          )}

          {state.players.map((player, index) => (
            <section key={player.id} className="cmp-player" style={{ ["--who" as string]: player.color }}>
              <div className="flex items-center gap-2">
                <span className="cmp-dot" />
                <input
                  className="cmp-name"
                  value={player.name}
                  onChange={(e) => edit((s) => updateRiftboundPlayer(s, index, { name: e.target.value }))}
                  placeholder={t("playerName", { number: index + 1 })}
                  aria-label={t("playerNameLabel", { number: index + 1 })}
                />
                {state.first === index && <span className="cmp-pill">{t("rb.starts")}</span>}
              </div>
              <DeckSelect
                decks={decks}
                value={player.deckName}
                onPick={(deck) =>
                  edit((s) =>
                    updateRiftboundPlayer(s, index, {
                      deckName: deck.name,
                      legend: deck.legend ?? s.players[index].legend,
                      battlefields: deck.battlefields?.length ? deck.battlefields : s.players[index].battlefields,
                      chosen: null,
                    }),
                  )
                }
              />
              <div className="flex gap-3">
                <CardThumb card={player.legend} width={70} height={98} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <div className="cmp-label">{t("rb.legend")}</div>
                    {player.legend ? (
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.legend.name}</span>
                        <button type="button" className="cmp-round h-8 w-8" onClick={() => edit((s) => updateRiftboundPlayer(s, index, { legend: null }))} aria-label={t("rb.clearLegend")}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <CardSearch game="riftbound" type="Legend" placeholder={t("rb.searchLegend")} label={t("rb.legend")} onPick={(legend) => edit((s) => updateRiftboundPlayer(s, index, { legend }))} />
                    )}
                  </div>
                  <div className="cmp-label">{t("rb.battlefields")}</div>
                  {player.battlefields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {player.battlefields.map((field, fieldIndex) => (
                        <span key={`${field.id}-${fieldIndex}`} className="relative">
                          <button
                            type="button"
                            className="block"
                            onClick={() => edit((s) => updateRiftboundPlayer(s, index, { chosen: fieldIndex }))}
                            aria-pressed={player.chosen === fieldIndex}
                            aria-label={t("rb.chooseField", { name: field.name })}
                          >
                            <CardThumb
                              card={field}
                              width={64}
                              height={46}
                              style={{
                                opacity: player.chosen === null || player.chosen === fieldIndex ? 1 : 0.35,
                                boxShadow: player.chosen === fieldIndex ? "0 0 0 2px var(--cmp-accent-ink)" : undefined,
                              }}
                            />
                          </button>
                          <button
                            type="button"
                            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-[10px]"
                            onClick={() =>
                              edit((s) =>
                                updateRiftboundPlayer(s, index, {
                                  battlefields: s.players[index].battlefields.filter((_, i) => i !== fieldIndex),
                                  chosen: null,
                                }),
                              )
                            }
                            aria-label={t("rb.removeField", { name: field.name })}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {player.battlefields.length < 3 && (
                    <CardSearch
                      game="riftbound"
                      type="Battlefield"
                      placeholder={t("rb.searchField")}
                      label={t("rb.battlefields")}
                      onPick={(field) =>
                        edit((s) => {
                          const fields = [...s.players[index].battlefields, field].slice(0, 3);
                          return updateRiftboundPlayer(s, index, { battlefields: fields, chosen: fields.length === 1 ? 0 : s.players[index].chosen });
                        })
                      }
                    />
                  )}
                  {player.chosen !== null && player.battlefields[player.chosen] && (
                    <p className="text-xs cmp-muted">{t("rb.fieldPlayed", { name: player.battlefields[player.chosen].name })}</p>
                  )}
                </div>
              </div>
            </section>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="cmp-button" onClick={() => edit((s) => drawBattlefields(s))}>
              <Dices className="h-4 w-4" /> {t("rb.drawFields")}
            </button>
            <button type="button" className="cmp-button" onClick={() => edit((s) => drawFirstPlayer(s))}>
              <Timer className="h-4 w-4" /> {t("whoStarts")}
            </button>
          </div>
          <p className="text-xs cmp-muted">{t("rb.setupHint")}</p>

          {state.phase === "setup" ? (
            <button
              type="button"
              className="cmp-start"
              onClick={() => {
                play((s) => startRiftbound(s, Date.now()));
                setAtTable(true);
              }}
            >
              {t("start")}
            </button>
          ) : (
            <button type="button" className="cmp-button" onClick={reset}>
              {t("newGame")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const target = riftboundTarget(state);
  const fields = riftboundFieldsInPlay(state);
  const many = state.players.length > 2;
  const names = state.players.map((p, i) => displayName(p.name, i));

  const fieldButtons = fields.map(({ card }, i) => {
    const owner = state.control[i];
    const color = owner === null || owner === undefined ? undefined : state.players[owner].color;
    return (
      <button
        key={`${card.id}-${i}`}
        type="button"
        className="cmp-field"
        style={color ? { ["--who" as string]: color } : undefined}
        onClick={() => play((s) => cycleRiftboundControl(s, i))}
        aria-label={t("rb.cycleControl", { name: card.name })}
      >
        {card.image && <img src={card.image} alt="" />}
        <span className="cmp-flag">{owner === null || owner === undefined ? t("rb.free") : names[owner]}</span>
        <span className="cmp-field-name">{card.name}</span>
      </button>
    );
  });

  const hub = many ? (
    <button type="button" className="cmp-round cmp-round-main" onClick={() => setMenu(true)} aria-label={t("menu")}>
      <Menu className="h-6 w-6" />
    </button>
  ) : (
    <div className="flex h-[124px] w-full items-center gap-2">
      {fieldButtons.length > 0 ? fieldButtons : <p className="flex-1 text-center text-xs cmp-muted">{t("rb.noField")}</p>}
      <div className="flex w-[96px] flex-none flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="cmp-title whitespace-nowrap text-sm">{t("rb.turn", { turn: state.turn })}</div>
          <LookupButton size={28} />
        </div>
        <button type="button" className="h-9 w-full rounded-full text-[11.5px] font-bold" style={{ background: "var(--cmp-accent-strong)", color: "var(--cmp-on-accent)" }} onClick={() => play(endRiftboundTurn)}>
          {t("rb.endTurn")}
        </button>
        <div className="flex gap-1.5">
          <button type="button" className="cmp-round h-9 w-9" onClick={undo} disabled={!canUndo} aria-label={t("undo")}>
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className="cmp-round h-9 w-9" onClick={() => setMenu(true)} aria-label={t("menu")}>
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CompanionTable
      game="riftbound"
      theme="rb"
      count={state.players.length}
      band
      hub={hub}
      seat={(index) => {
        const player = state.players[index];
        const lastPoint = player.score === target - 1;
        return (
          <div className="relative flex h-full flex-col gap-2 p-3" style={{ ["--who" as string]: player.color }}>
            {player.legend?.image && (
              <img src={player.legend.image} alt="" className="pointer-events-none absolute -right-[8%] -top-[12%] w-[70%] opacity-20" />
            )}
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(7 5 4 / 0), rgb(7 5 4 / 0.85))" }} />
            <div className="relative flex items-center gap-2">
              <CardThumb card={player.legend} width={30} height={42} style={{ boxShadow: `0 0 0 2px ${player.color}` }} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold" style={{ color: player.color }}>{names[index]}</div>
                {player.legend && <div className="truncate text-[11px] cmp-muted">{player.legend.name}</div>}
              </div>
              {state.active === index && <span className="cmp-pill">{t("rb.yourTurn")}</span>}
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center gap-4">
              <button type="button" className="cmp-round h-14 w-14" onClick={() => play((s) => scoreRiftbound(s, index, -1, "other", Date.now()))} aria-label={t("rb.minus", { name: names[index] })}>
                <Minus className="h-5 w-5" />
              </button>
              <div className="cmp-rb-score" aria-live="polite">
                <div>
                  <strong>{player.score}</strong>
                  <span>{t("rb.outOf", { target })}</span>
                </div>
              </div>
              <button type="button" className="cmp-round h-14 w-14" onClick={() => play((s) => scoreRiftbound(s, index, 1, "other", Date.now()))} aria-label={t("rb.plus", { name: names[index] })}>
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex justify-center gap-1" aria-hidden="true">
              {Array.from({ length: target }, (_, k) => (
                <span key={k} className="cmp-pip" data-on={k < player.score ? "true" : "false"} />
              ))}
            </div>
            {lastPoint && (
              <p className="relative m-0 rounded-lg border px-2.5 py-1.5 text-center text-[11.5px] leading-snug" style={{ borderColor: "rgb(201 164 90 / 0.4)", background: "rgb(201 164 90 / 0.12)", color: "#f1dca4" }}>
                {t("rb.lastPoint")}
              </p>
            )}
            <div className={cn("relative grid gap-2", many ? "grid-cols-3" : "grid-cols-2")}>
              <button type="button" className="cmp-rb-act" onClick={() => play((s) => scoreRiftbound(s, index, 1, "hold", Date.now()))}>
                {t("rb.hold")}
              </button>
              <button type="button" className="cmp-rb-act" onClick={() => play((s) => scoreRiftbound(s, index, 1, "conquer", Date.now()))}>
                {t("rb.conquer")}
              </button>
              {many && (
                <button type="button" className="cmp-rb-act" disabled={state.active !== index} style={{ opacity: state.active === index ? 1 : 0.4 }} onClick={() => play(endRiftboundTurn)}>
                  {t("rb.endTurn")}
                </button>
              )}
            </div>
          </div>
        );
      }}
    >
      {!many && state.phase === "playing" && <LastEvent log={state.log} style={{ top: "50%", marginTop: -78 }} />}

      <GameMenu
        open={menu}
        onClose={() => setMenu(false)}
        canUndo={canUndo}
        onUndo={undo}
        onRestart={() => {
          reset();
          setMenu(false);
        }}
        onExit={() => {
          setMenu(false);
          setAtTable(false);
        }}
        log={state.log}
        turnLabel={(turn) => t("rb.turnShort", { turn })}
      >
        {many && (
          <div className="flex flex-col gap-2">
            <span className="cmp-label">{t("rb.turn", { turn: state.turn })}</span>
            <div className="flex h-24 gap-2">{fieldButtons}</div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="cmp-label">{t("rb.extraCounters")}</span>
          {state.players.map((p, i) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 truncate font-semibold" style={{ color: p.color }}>{names[i]}</span>
              {(["energy", "power"] as const).map((counter) => (
                <span key={counter} className="flex items-center gap-1">
                  <span className="cmp-muted">{t(`rb.${counter}`)}</span>
                  <button type="button" className="cmp-round h-8 w-8" onClick={() => edit((s) => adjustRiftboundCounter(s, i, counter, -1))} aria-label={`-1 ${t(`rb.${counter}`)}`}>
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center tabular-nums">{p[counter]}</span>
                  <button type="button" className="cmp-round h-8 w-8" onClick={() => edit((s) => adjustRiftboundCounter(s, i, counter, 1))} aria-label={`+1 ${t(`rb.${counter}`)}`}>
                    <Plus className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </GameMenu>

      {state.phase === "over" && state.winner !== undefined && (
        <RiftboundVictory
          state={state}
          onRematch={() => {
            edit((s) => rematchRiftbound(s));
            setAtTable(true);
          }}
          onNew={reset}
          onUndo={undo}
        />
      )}
    </CompanionTable>
  );
}

function RiftboundVictory({ state, onRematch, onNew, onUndo }: { state: RiftboundState; onRematch: () => void; onNew: () => void; onUndo: () => void }) {
  const t = useTranslations("Games.Companion");
  const winner = state.players[state.winner ?? 0];
  const names = state.players.map((p, i) => displayName(p.name, i));
  const target = riftboundTarget(state);
  const minutes = state.startedAt && state.endedAt ? Math.max(1, Math.round((state.endedAt - state.startedAt) / 60000)) : null;
  const series = state.scoreByTurn;
  const width = 300;
  const height = 90;
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const y = (score: number) => height - 6 - (score / target) * (height - 12);

  return (
    <div className="cmp-over">
      {winner.legend?.image && (
        <img src={winner.legend.image} alt={winner.legend.name} className="h-[180px] w-auto -rotate-3 rounded-[10px]" style={{ boxShadow: "0 0 0 3px #c9a45a, 0 0 40px rgb(241 220 164 / 0.35), 0 20px 40px rgb(0 0 0 / 0.8)" }} />
      )}
      <div>
        <div className="text-[11px] tracking-widest cmp-muted" style={{ fontFamily: "var(--cmp-mono)" }}>
          {t(`rb.mode.${state.mode}`).toUpperCase()}
          {minutes ? ` · ${t("minutes", { minutes })}` : ""} · {t("rb.turnsCount", { turns: state.turn })}
        </div>
        <h2 className="cmp-title m-0 text-3xl" style={{ fontWeight: 900 }}>{t("winner", { name: names[state.winner ?? 0] })}</h2>
        <div className="cmp-title mt-1 flex justify-center gap-3 text-3xl">
          {state.players.map((p, i) => (
            <span key={p.id} style={{ color: p.color }}>
              {p.score}
              {i < state.players.length - 1 && <span className="ml-3 text-xl" style={{ color: "#7a5f2c" }}>–</span>}
            </span>
          ))}
        </div>
      </div>
      {series.length > 1 && (
        <div className="w-full max-w-sm rounded-[14px] border p-3" style={{ borderColor: "#4a3620", background: "rgb(0 0 0 / 0.3)" }}>
          <div className="cmp-label text-left">{t("rb.scoreByTurn")}</div>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={t("rb.scoreByTurn")}>
            {state.players.map((p, i) => (
              <polyline
                key={p.id}
                fill="none"
                stroke={p.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                points={series.map((row, k) => `${k * step},${y(row[i] ?? 0)}`).join(" ")}
              />
            ))}
          </svg>
          <div className="mt-1 grid gap-1 text-left text-xs">
            {state.players.map((p, i) => (
              <div key={p.id}>
                <span className="font-bold" style={{ color: p.color }}>{names[i]}</span> · {t("rb.stats", { holds: p.holds, conquers: p.conquers })}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex w-full max-w-sm flex-col gap-2">
        <button type="button" className="cmp-start" onClick={onRematch}>{t("rematch")}</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="cmp-button" onClick={onNew}>{t("newGame")}</button>
          <button type="button" className="cmp-button" onClick={onUndo}>{t("undoLast")}</button>
        </div>
        <p className="text-[11px] cmp-muted">{t("rb.rematchHint")}</p>
      </div>
    </div>
  );
}
