import { useState } from "react";
import { useTranslations } from "./i18n";
import { Dices, Menu, Undo2, X } from "./icons";

import {
  damageSwuBase,
  displayName,
  drawSwuInitiative,
  newSwu,
  nextSwuRound,
  passSwuInitiative,
  rematchSwu,
  setSwuFormat,
  setSwuPlayerCount,
  startSwu,
  swuMaxHp,
  swuRemainingHp,
  toggleSwu,
  updateSwuPlayer,
  type CompanionCard,
  type SwuFormat,
} from "./state";
import { cn } from "./cn";

import {
  CardSearch,
  CardThumb,
  CompanionTable,
  DeckSelect,
  GameMenu,
  LastEvent,
  companionFonts,
  useCompanion,
  useCompanionDecks,
  useLockedScroll,
  useWakeLock,
} from "./shared";

const FORMATS: SwuFormat[] = ["premier", "twinSuns"];
const LOW_HP = 5;

function CardPick({
  label,
  card,
  type,
  placeholder,
  onPick,
  onClear,
  footer,
}: {
  label: string;
  card: CompanionCard | null;
  type: string;
  placeholder: string;
  onPick: (card: CompanionCard) => void;
  onClear: () => void;
  footer?: string;
}) {
  const t = useTranslations("Games.Companion");
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="cmp-label">{label}</span>
      {card ? (
        <>
          <span className="relative">
            <CardThumb card={card} width={0} height={0} className="block w-full" style={{ width: "100%", height: "auto", aspectRatio: "7 / 5" }} />
            <button type="button" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/80" onClick={onClear} aria-label={t("swu.clear", { name: card.name })}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="truncate text-[12.5px] font-semibold">{card.name}</span>
          {footer && <span className="text-[11px]" style={{ fontFamily: "var(--cmp-mono)", color: "#9fe3ff" }}>{footer}</span>}
        </>
      ) : (
        <CardSearch game="swu" type={type} placeholder={placeholder} label={label} onPick={onPick} />
      )}
    </div>
  );
}

/** Le compagnon de Star Wars: Unlimited : base, leader, initiative et round. */
export function SwuCompanion() {
  const t = useTranslations("Games.Companion");
  const { state, canUndo, hydrated, play, edit, undo, reset } = useCompanion("swu", () => newSwu());
  const decks = useCompanionDecks("swu");
  const [atTable, setAtTable] = useState(true);
  const [menu, setMenu] = useState(false);

  const showTable = hydrated && state.phase !== "setup" && atTable;
  useWakeLock(showTable);
  useLockedScroll(showTable);

  if (!showTable) {
    return (
      <div className={cn("cmp cmp-swu", companionFonts)}>
        <div className="cmp-setup">
          {state.phase !== "setup" && (
            <button type="button" className="cmp-button w-full" onClick={() => setAtTable(true)}>
              {t("resume")}
            </button>
          )}
          <div className="cmp-segments" role="group" aria-label={t("mode")}>
            {FORMATS.map((format) => (
              <button key={format} type="button" className="cmp-segment" aria-pressed={state.format === format} onClick={() => edit((s) => setSwuFormat(s, format))} disabled={state.phase !== "setup"}>
                {t(`swu.format.${format}`)}
                <small>{t(`swu.formatHint.${format}`)}</small>
              </button>
            ))}
          </div>
          {state.format === "twinSuns" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="cmp-label">{t("players")}</span>
              {[3, 4].map((n) => (
                <button key={n} type="button" className="cmp-button" aria-pressed={state.players.length === n} onClick={() => edit((s) => setSwuPlayerCount(s, n))}>
                  {n}
                </button>
              ))}
            </div>
          )}

          {state.players.map((player, index) => (
            <section key={player.id} className="cmp-player" style={{ ["--who" as string]: player.color }}>
              <div className="flex items-center gap-2">
                <input
                  className="cmp-name"
                  value={player.name}
                  onChange={(e) => edit((s) => updateSwuPlayer(s, index, { name: e.target.value }))}
                  placeholder={t("playerName", { number: index + 1 })}
                  aria-label={t("playerNameLabel", { number: index + 1 })}
                />
                {state.initiative === index && <span className="cmp-pill">{t("swu.initiative")}</span>}
              </div>
              <DeckSelect
                decks={decks}
                value={player.deckName}
                onPick={(deck) =>
                  edit((s) =>
                    updateSwuPlayer(s, index, {
                      deckName: deck.name,
                      leader: deck.leader ?? s.players[index].leader,
                      base: deck.base ?? s.players[index].base,
                    }),
                  )
                }
              />
              <div className="grid grid-cols-2 gap-2.5">
                <CardPick
                  label={t("swu.leader")}
                  card={player.leader}
                  type="Leader"
                  placeholder={t("swu.searchLeader")}
                  onPick={(leader) => edit((s) => updateSwuPlayer(s, index, { leader }))}
                  onClear={() => edit((s) => updateSwuPlayer(s, index, { leader: null }))}
                />
                <CardPick
                  label={t("swu.base")}
                  card={player.base}
                  type="Base"
                  placeholder={t("swu.searchBase")}
                  onPick={(base) => edit((s) => updateSwuPlayer(s, index, { base }))}
                  onClear={() => edit((s) => updateSwuPlayer(s, index, { base: null }))}
                  footer={t("hpShort", { hp: swuMaxHp(player) })}
                />
              </div>
            </section>
          ))}

          <button type="button" className="cmp-button" onClick={() => edit((s) => drawSwuInitiative(s))}>
            <Dices className="h-4 w-4" /> {t("swu.drawInitiative")}
          </button>
          <p className="text-xs cmp-muted">{t("swu.setupHint")}</p>

          {state.phase === "setup" ? (
            <button
              type="button"
              className="cmp-start"
              onClick={() => {
                play((s) => startSwu(s, Date.now()));
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

  const many = state.players.length > 2;
  const names = state.players.map((p, i) => displayName(p.name, i));

  const initiativeButton = (
    <button type="button" className="cmp-swu-init" onClick={() => play((s) => passSwuInitiative(s))} aria-label={t("swu.passInitiative")}>
      {t("swu.initShort")}
      <br />
      <span className="text-sm">{names[state.initiative]}</span>
    </button>
  );

  const hub = many ? (
    <button type="button" className="cmp-round cmp-round-main" onClick={() => setMenu(true)} aria-label={t("menu")}>
      <Menu className="h-6 w-6" />
    </button>
  ) : (
    <div className="cmp-swu-hubrow flex h-[96px] w-full items-center gap-2.5">
      {initiativeButton}
      <div className="flex-1 text-center">
        <div className="text-[10px] tracking-[0.3em] cmp-muted" style={{ fontFamily: "var(--cmp-mono)" }}>{t("swu.round")}</div>
        <div className="text-4xl font-bold leading-none" style={{ fontFamily: "var(--cmp-mono)", color: "#5cc8ff", textShadow: "0 0 12px #5cc8ff" }}>{state.round}</div>
      </div>
      <div className="cmp-swu-hubtools flex w-[104px] flex-col gap-1.5">
        <button type="button" className="h-9 rounded-[2px] text-[10.5px] font-bold tracking-wider" style={{ background: "#5cc8ff", color: "#02060c", fontFamily: "var(--cmp-mono)" }} onClick={() => play(nextSwuRound)}>
          {t("swu.regroup")}
        </button>
        <div className="flex gap-1.5">
          <button type="button" className="cmp-round h-8 flex-1" onClick={undo} disabled={!canUndo} aria-label={t("undo")}>
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className="cmp-round h-8 flex-1" onClick={() => setMenu(true)} aria-label={t("menu")}>
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CompanionTable
      theme="swu"
      count={state.players.length}
      band
      hub={hub}
      seat={(index) => {
        const player = state.players[index];
        const hp = swuRemainingHp(player);
        const max = swuMaxHp(player);
        const low = hp <= LOW_HP;
        const leaderImage = player.deployed && player.leader?.backImage ? player.leader.backImage : player.leader?.image;
        const portrait = player.deployed && !!player.leader?.backImage;
        return (
          <div
            className="relative flex h-full flex-col gap-2.5 p-3"
            style={{ ["--who" as string]: player.color, background: `radial-gradient(90% 70% at 50% 100%, color-mix(in srgb, ${player.color} 28%, transparent) 0%, #02060c 70%)` }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgb(92 200 255 / 0.04) 0 1px, transparent 1px 3px)" }} />
            <div className="cmp-swu-band relative">
              <span className="font-bold tracking-wider" style={{ color: player.color }}>{names[index].toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate cmp-muted">{player.base?.name}</span>
              {state.initiative === index && <span className="cmp-pill">{t("swu.initiative")}</span>}
            </div>
            <div className="cmp-swu-body relative flex min-h-0 flex-1 gap-3">
              <div className="cmp-swu-main flex min-w-0 flex-1 flex-col items-center justify-center gap-2">
                <div className="cmp-swu-label text-[10px] tracking-[0.24em] cmp-muted" style={{ fontFamily: "var(--cmp-mono)" }}>{t("swu.baseHp")}</div>
                <div className="flex flex-none items-baseline gap-1" aria-live="polite">
                  <span className="cmp-swu-hp" data-low={low ? "true" : "false"}>{hp}</span>
                  <span className="text-lg cmp-muted" style={{ fontFamily: "var(--cmp-mono)" }}>/{max}</span>
                </div>
                <div className="cmp-swu-cells flex w-full justify-center gap-0.5" aria-hidden="true">
                  {Array.from({ length: max }, (_, k) => (
                    <span key={k} className="cmp-swu-cell" data-on={k < hp ? "true" : "false"} data-low={low ? "true" : "false"} />
                  ))}
                </div>
                <div className="cmp-swu-hits grid w-full grid-cols-3 gap-1.5">
                  <button type="button" className="cmp-swu-hit" data-heal="true" onClick={() => play((s) => damageSwuBase(s, index, -1, Date.now()))}>
                    {t("swu.heal")}
                  </button>
                  <button type="button" className="cmp-swu-hit" onClick={() => play((s) => damageSwuBase(s, index, 1, Date.now()))} aria-label={t("swu.damage", { amount: 1, name: names[index] })}>
                    −1
                  </button>
                  <button type="button" className="cmp-swu-hit" onClick={() => play((s) => damageSwuBase(s, index, 3, Date.now()))} aria-label={t("swu.damage", { amount: 3, name: names[index] })}>
                    −3
                  </button>
                </div>
              </div>
              <div className="cmp-swu-side flex w-[34%] max-w-[140px] flex-none flex-col gap-1.5">
                <button
                  type="button"
                  className="cmp-swu-leader relative min-h-0 p-0"
                  style={{ aspectRatio: portrait ? "5 / 7" : "7 / 5", maxHeight: "60%" }}
                  onClick={() => play((s) => toggleSwu(s, index, "deployed"))}
                  aria-pressed={player.deployed}
                  aria-label={player.deployed ? t("swu.undeploy") : t("swu.deploy")}
                >
                  {leaderImage ? (
                    <img src={leaderImage} alt={player.leader?.name ?? ""} className="h-full w-full rounded object-cover" style={{ boxShadow: `0 0 0 1px ${player.color}, 0 0 16px -4px ${player.color}` }} />
                  ) : (
                    <span className="grid h-full w-full place-items-center rounded border text-[10px] cmp-muted" style={{ borderColor: "var(--cmp-line)" }}>{t("swu.leader")}</span>
                  )}
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[2px] px-1.5 py-0.5 text-[9.5px] tracking-wider" style={{ fontFamily: "var(--cmp-mono)", background: player.deployed ? player.color : "#8fb3c7", color: "#02060c" }}>
                    {player.deployed ? t("swu.deployed") : t("swu.deployShort")}
                  </span>
                </button>
                <span className="cmp-swu-leader h-1.5" />
                {/* Place trop basse pour la carte (téléphone en paysage) : le leader devient un bouton. */}
                <button type="button" className="cmp-swu-toggle cmp-swu-deploy" aria-pressed={player.deployed} onClick={() => play((s) => toggleSwu(s, index, "deployed"))}>
                  {player.deployed ? t("swu.deployed") : t("swu.deployShort")}
                </button>
                <button type="button" className="cmp-swu-toggle" aria-pressed={player.epicUsed} onClick={() => play((s) => toggleSwu(s, index, "epicUsed"))}>
                  {player.epicUsed ? `${t("swu.epic")} ✓` : t("swu.epic")}
                </button>
                <button type="button" className="cmp-swu-toggle" aria-pressed={player.force} onClick={() => play((s) => toggleSwu(s, index, "force"))}>
                  {player.force ? `${t("swu.force")} ●` : `${t("swu.force")} ○`}
                </button>
                {many && state.initiative !== index && (
                  <button type="button" className="cmp-swu-toggle" onClick={() => play((s) => passSwuInitiative(s, index))}>
                    {t("swu.takeInitiative")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      }}
    >
      {!many && state.phase === "playing" && <LastEvent log={state.log} style={{ top: "50%", marginTop: -66 }} />}

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
        turnLabel={(round) => t("swu.roundShort", { round })}
      >
        {many && (
          <div className="flex flex-wrap items-center gap-3">
            {initiativeButton}
            <div>
              <div className="cmp-label">{t("swu.round")}</div>
              <div className="text-3xl font-bold" style={{ fontFamily: "var(--cmp-mono)", color: "#5cc8ff" }}>{state.round}</div>
            </div>
            <button type="button" className="cmp-button" onClick={() => play(nextSwuRound)}>
              {t("swu.regroup")}
            </button>
          </div>
        )}
      </GameMenu>

      {state.phase === "over" && state.winner !== undefined && (
        <div className="cmp-over">
          <div className="text-xs tracking-[0.3em]" style={{ fontFamily: "var(--cmp-mono)", color: "#ff7a45" }}>{t("swu.destroyed")}</div>
          <h2 className="m-0 text-3xl font-bold" style={{ fontFamily: "var(--cmp-mono)", color: "#5cc8ff", textShadow: "0 0 14px #5cc8ff" }}>
            {t("winner", { name: names[state.winner] }).toUpperCase()}
          </h2>
          <p className="cmp-muted text-sm">{t("swu.overStats", { round: state.round })}</p>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <button type="button" className="cmp-start" onClick={() => edit(rematchSwu)}>{t("rematch")}</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="cmp-button" onClick={reset}>{t("newGame")}</button>
              <button type="button" className="cmp-button" onClick={undo}>{t("undoLast")}</button>
            </div>
          </div>
        </div>
      )}
    </CompanionTable>
  );
}
