import { useEffect, useRef, useState } from "react";
import { useTranslations } from "./i18n";
import { Crown, Droplet, Menu, Minus, Plus, Undo2, X } from "./icons";

import {
  MTG_COLORS,
  MTG_COUNTERS,
  changeMtgCounter,
  changeMtgLife,
  displayName,
  mtgCommanderDamage,
  mtgIsOut,
  newMtg,
  setMtgFormat,
  setMtgMonarch,
  setMtgPlayerCount,
  setMtgStartingLife,
  startMtg,
  toggleMtgCounter,
  updateMtgPlayer,
  type MtgFormat,
  type MtgState,
} from "./state";
import { cn } from "./cn";

import {
  CardSearch,
  CardThumb,
  CompanionTable,
  GameMenu,
  companionFonts,
  useCompanion,
  useLockedScroll,
  useWakeLock,
} from "./shared";

const FORMATS: MtgFormat[] = ["duel", "commander", "brawl", "custom"];

/**
 * L'écart de points de vie en cours : « −3 » s'affiche tant qu'on tape, puis
 * s'efface. Il se calcule ici, pas dans l'état enregistré.
 */
function useLifeDeltas(state: MtgState) {
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const previous = useRef<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const changes: Record<string, number> = {};
    // Pendant la préparation, changer de format change les points de vie de
    // départ : ce n'est pas un coup de la partie, il ne s'affiche pas.
    const counting = state.phase !== "setup";
    for (const p of state.players) {
      const before = previous.current[p.id];
      if (counting && before !== undefined && before !== p.life) changes[p.id] = p.life - before;
      previous.current[p.id] = p.life;
    }
    const ids = Object.keys(changes);
    if (ids.length === 0) return;
    setDeltas((d) => {
      const next = { ...d };
      for (const id of ids) next[id] = (next[id] ?? 0) + changes[id];
      return next;
    });
    for (const id of ids) {
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => setDeltas((d) => ({ ...d, [id]: 0 })), 1800);
    }
  }, [state.players, state.phase]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  return deltas;
}

/** Le compagnon de Magic : points de vie de 2 à 6 joueurs, et les compteurs choisis. */
export function MtgCompanion() {
  const t = useTranslations("Games.Companion");
  const { state, canUndo, hydrated, play, edit, undo, reset } = useCompanion("mtg", () => newMtg());
  const [atTable, setAtTable] = useState(true);
  const [menu, setMenu] = useState(false);
  const deltas = useLifeDeltas(state);

  const showTable = hydrated && state.phase !== "setup" && atTable;
  useWakeLock(showTable);
  useLockedScroll(showTable);

  if (!showTable) {
    return (
      <div className={cn("cmp cmp-mtg", companionFonts)}>
        <div className="cmp-setup">
          {state.phase !== "setup" && (
            <button type="button" className="cmp-button w-full" onClick={() => setAtTable(true)}>
              {t("resume")}
            </button>
          )}
          <div>
            <div className="cmp-label mb-1.5">{t("mtg.format")}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  className="cmp-segment border"
                  style={{ borderColor: state.format === format ? "var(--cmp-accent)" : "var(--cmp-line)", minHeight: 56 }}
                  aria-pressed={state.format === format}
                  onClick={() => edit((s) => setMtgFormat(s, format))}
                >
                  {t(`mtg.formats.${format}`)}
                  <small className="text-base font-bold">{format === "custom" ? state.startingLife : t(`mtg.life.${format}`)}</small>
                </button>
              ))}
            </div>
            {state.format === "custom" && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <span className="cmp-muted">{t("mtg.startingLife")}</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={state.startingLife}
                  onChange={(e) => edit((s) => setMtgStartingLife(s, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border bg-transparent px-2 py-1"
                  style={{ borderColor: "var(--cmp-line)", color: "var(--cmp-ink)" }}
                />
              </label>
            )}
          </div>

          <div>
            <div className="cmp-label mb-1.5">{t("players")}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" className="cmp-button" aria-pressed={state.players.length === n} onClick={() => edit((s) => setMtgPlayerCount(s, n))}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="cmp-label">{t("mtg.colorAndName")}</div>
            {state.players.map((player, index) => (
              <div key={player.id} className="flex flex-col gap-2 rounded-xl border p-2.5" style={{ borderColor: "#3a3040", background: "var(--cmp-surface)" }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1" role="radiogroup" aria-label={t("mtg.color", { number: index + 1 })}>
                    {MTG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={player.color === color}
                        aria-label={color}
                        className="h-6 w-6 rounded-full"
                        style={{ background: color, boxShadow: player.color === color ? "0 0 0 2px #15121a, 0 0 0 4px #fbf3df" : "none" }}
                        onClick={() => edit((s) => updateMtgPlayer(s, index, { color }))}
                      />
                    ))}
                  </div>
                  <input
                    className="cmp-name"
                    value={player.name}
                    onChange={(e) => edit((s) => updateMtgPlayer(s, index, { name: e.target.value }))}
                    placeholder={t("playerName", { number: index + 1 })}
                    aria-label={t("playerNameLabel", { number: index + 1 })}
                  />
                </div>
                {state.counters.includes("commander") &&
                  (player.commander ? (
                    <div className="flex items-center gap-2 text-sm">
                      <CardThumb card={player.commander} width={30} height={42} />
                      <span className="min-w-0 flex-1 truncate">{player.commander.name}</span>
                      <button type="button" className="cmp-round h-8 w-8" onClick={() => edit((s) => updateMtgPlayer(s, index, { commander: null }))} aria-label={t("mtg.clearCommander")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <CardSearch game="mtg" placeholder={t("mtg.searchCommander")} label={t("mtg.commander")} onPick={(commander) => edit((s) => updateMtgPlayer(s, index, { commander }))} />
                  ))}
              </div>
            ))}
          </div>

          <div>
            <div className="cmp-label mb-1.5">{t("mtg.counters")}</div>
            <div className="flex flex-wrap gap-1.5">
              {MTG_COUNTERS.map((counter) => (
                <button key={counter} type="button" className="cmp-button" aria-pressed={state.counters.includes(counter)} onClick={() => edit((s) => toggleMtgCounter(s, counter))}>
                  {t(`mtg.counter.${counter}`)}
                </button>
              ))}
            </div>
          </div>

          {state.phase === "setup" ? (
            <button
              type="button"
              className="cmp-start"
              onClick={() => {
                play((s) => startMtg(s, Date.now()));
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

  const names = state.players.map((p, i) => displayName(p.name, i));
  const compact = state.players.length > 2;

  return (
    <CompanionTable
      theme="mtg"
      count={state.players.length}
      band={false}
      hub={
        <div className="flex items-center gap-2">
          {!compact && (
            <button type="button" className="cmp-round h-10 w-10" onClick={undo} disabled={!canUndo} aria-label={t("undo")}>
              <Undo2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" className="cmp-round cmp-round-main" onClick={() => setMenu(true)} aria-label={t("menu")}>
            <Menu className="h-6 w-6" />
          </button>
        </div>
      }
      seat={(index) => {
        const player = state.players[index];
        const delta = deltas[player.id] ?? 0;
        const opponents = state.players.map((o, j) => ({ o, j })).filter(({ j }) => j !== index);
        return (
          <div
            className={cn("relative h-full overflow-hidden rounded-[20px]", mtgIsOut(player) && "cmp-mtg-out")}
            style={{
              background: `radial-gradient(90% 80% at 50% 45%, color-mix(in srgb, ${player.color} 32%, transparent) 0%, #15121a 75%)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${player.color} 50%, transparent)`,
            }}
          >
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="cmp-mtg-life" aria-live="polite">{player.life}</div>
                <div className="h-6 text-lg font-bold" style={{ color: delta > 0 ? "#9ee6a8" : "#ffb19f" }}>
                  {delta === 0 ? "" : delta > 0 ? `+${delta}` : `${delta}`}
                </div>
              </div>
            </div>
            <button type="button" className="cmp-mtg-half left-0 pl-4" onClick={() => play((s) => changeMtgLife(s, index, -1))} aria-label={t("mtg.lifeMinus", { name: names[index] })}>
              <Minus className="h-6 w-6" />
            </button>
            <button type="button" className="cmp-mtg-half right-0 justify-end pr-4" onClick={() => play((s) => changeMtgLife(s, index, 1))} aria-label={t("mtg.lifePlus", { name: names[index] })}>
              <Plus className="h-6 w-6" />
            </button>
            <div className="absolute left-3 top-2.5 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: player.color }} />
              <span className="text-sm font-semibold">{names[index]}</span>
              {state.monarch === player.id && (
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "#d8c38f", color: "#15121a" }}>{t("mtg.counter.monarch")}</span>
              )}
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-center gap-1.5">
              {state.counters.includes("commander") &&
                opponents.map(({ o, j }) => (
                  <button
                    key={o.id}
                    type="button"
                    className="cmp-mtg-chip"
                    style={{ ["--chip" as string]: o.color }}
                    onClick={() => play((s) => mtgCommanderDamage(s, index, j, 1))}
                    aria-label={t("mtg.commanderDamage", { from: names[j], to: names[index], value: player.commanderDamage[o.id] ?? 0 })}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: o.color }} />
                    {player.commanderDamage[o.id] ?? 0}
                  </button>
                ))}
              {state.counters.includes("poison") && (
                <button type="button" className="cmp-mtg-chip" style={{ color: "#cfe7c4" }} onClick={() => play((s) => changeMtgCounter(s, index, "poison", 1))} aria-label={t("mtg.addPoison", { name: names[index], value: player.poison })}>
                  <Droplet className="h-3.5 w-3.5" /> {player.poison}
                </button>
              )}
              {state.counters.includes("energy") && (
                <button type="button" className="cmp-mtg-chip" onClick={() => play((s) => changeMtgCounter(s, index, "energy", 1))} aria-label={t("mtg.addCounter", { counter: t("mtg.counter.energy"), name: names[index], value: player.energy })}>
                  ϟ {player.energy}
                </button>
              )}
              {state.counters.includes("experience") && (
                <button type="button" className="cmp-mtg-chip" onClick={() => play((s) => changeMtgCounter(s, index, "experience", 1))} aria-label={t("mtg.addCounter", { counter: t("mtg.counter.experience"), name: names[index], value: player.experience })}>
                  XP {player.experience}
                </button>
              )}
            </div>
          </div>
        );
      }}
    >
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
      >
        <div className="flex flex-col gap-2">
          <span className="cmp-label">{t("mtg.adjust")}</span>
          {state.players.map((p, i) => (
            <div key={p.id} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="w-20 truncate font-semibold" style={{ color: p.color }}>{names[i]}</span>
              {[-5, -1, 1, 5].map((n) => (
                <button key={n} type="button" className="cmp-button min-h-9 px-2.5" onClick={() => play((s) => changeMtgLife(s, i, n))}>
                  {n > 0 ? `+${n}` : n}
                </button>
              ))}
              {state.counters.includes("poison") && (
                <button type="button" className="cmp-button min-h-9 px-2.5" onClick={() => play((s) => changeMtgCounter(s, i, "poison", -1))} aria-label={t("mtg.removePoison", { name: names[i] })}>
                  <Droplet className="h-3.5 w-3.5" /> −1
                </button>
              )}
              {state.counters.includes("monarch") && (
                <button type="button" className="cmp-button min-h-9 px-2.5" aria-pressed={state.monarch === p.id} onClick={() => play((s) => setMtgMonarch(s, i))} aria-label={t("mtg.makeMonarch", { name: names[i] })}>
                  <Crown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {state.counters.includes("commander") && <p className="text-xs cmp-muted">{t("mtg.commanderHint")}</p>}
        </div>
      </GameMenu>
    </CompanionTable>
  );
}
