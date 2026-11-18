import "./limited.css";

import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createLimitedEvent,
  listLimitedEvents,
  loadLobby,
  type LimitedEventSummary,
  type LimitedTimers,
  type PlayGame,
} from "../../api/play";
import { BackHeader } from "../../components/BackHeader";
import {
  readLimitedSave,
  writeLimitedSave,
  type BoosterSet,
  type LimitedKind,
  type LimitedRecord,
  type LimitedSettings,
} from "../../engine/limited";
import type { LimitedProfile } from "../../engine/limited-profile";
import { BOT_LEVELS, type BotLevel } from "../../engine/types";
import { BotIcon, GlobeIcon } from "../icons";
import { usePlayT } from "../t";
import { Toggle, useToast } from "../ui";

const TABLE_SIZES = [2, 4, 6, 8];

type Where = "ai" | "online";

/** Les délais proposés à l'hôte, en secondes ; 0 : pas de limite. */
const PICK_DELAYS = [0, 30, 60, 90, 120];
const BUILD_DELAYS = [0, 600, 1200, 1800, 2700];

/** Un délai en clair : « 60 s », « 20 min », ou « sans limite ». */
export function useDelayLabel(): (seconds: number) => string {
  const t = usePlayT("Limited");
  return (seconds) =>
    seconds === 0
      ? t("setup.noLimit")
      : seconds < 120
        ? t("setup.seconds", { count: seconds })
        : t("setup.minutes", { count: Math.round(seconds / 60) });
}

/** Le message d'un refus : celui des évènements s'il existe, sinon celui des tables. */
export function useLimitedError(): (code: string) => string {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  return (code) => (t.has(`online.error.${code}`) ? t(`online.error.${code}`) : tPlay(`error.${code}`));
}

/** Le code d'un évènement dans ce qu'on a collé : le code seul, ou le lien du site (`…/limited/room?id=`). */
function eventCode(raw: string): string {
  return raw.trim().toLowerCase().split("id=").pop()?.split("&")[0] ?? "";
}

/** Ce que la page Jouer sait de la personne : connectée, abonnée, serveur de parties branché. */
type Lobby = { name: string | null; online: boolean; signedIn: boolean; canHost: boolean };

/**
 * Les réglages d'un scellé ou d'un draft : les boosters, puis où il se joue.
 * Contre des IA, l'évènement est créé par le moteur sur l'appareil et y est
 * gardé. En ligne, Joutes ouvre une salle d'attente. `profile` dit de quel jeu.
 */
export function LimitedSetup({ profile, game, kind }: { profile: LimitedProfile; game: PlayGame; kind: LimitedKind }) {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  const navigate = useNavigate();
  const { toast, node } = useToast();
  const rules = profile.rules(kind);
  const [sets, setSets] = useState<BoosterSet[] | null>(null);
  const [failed, setFailed] = useState(false);
  // L'extension de chaque booster ; `null` : la première extension proposée.
  const [packs, setPacks] = useState<(string | null)[]>([]);
  const [mixed, setMixed] = useState(false);
  const [players, setPlayers] = useState<number | null>(null);
  const [level, setLevel] = useState<BotLevel>("normal");
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState<Where>("ai");
  const [timers, setTimers] = useState<LimitedTimers>({ pick: 60, build: 1200 });
  const [code, setCode] = useState("");
  const [mine, setMine] = useState<LimitedEventSummary[]>([]);
  // Sans réponse du site (hors connexion) : contre des IA seulement, sous le nom par défaut.
  const [lobby, setLobby] = useState<Lobby>({ name: null, online: false, signedIn: false, canHost: false });
  const [replaces] = useState(() => readLimitedSave(profile.storageKey) !== null);
  const errorText = useLimitedError();
  const delayLabel = useDelayLabel();

  useEffect(() => {
    let cancelled = false;
    void loadLobby(game).then((result) => {
      if (cancelled || !result.ok) return;
      const { name, online, signedIn, access } = result.lobby;
      setLobby({ name, online, signedIn, canHost: access?.canHost ?? true });
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  const listed = lobby.online && lobby.signedIn;
  useEffect(() => {
    if (!listed) return;
    let cancelled = false;
    void listLimitedEvents(game).then((result) => {
      if (!cancelled && result.ok) setMine(result.events.filter((event) => event.kind === kind));
    });
    return () => {
      cancelled = true;
    };
  }, [listed, kind, game]);

  useEffect(() => {
    let cancelled = false;
    profile
      .engine()
      .then((engine) => {
        if (!cancelled) setSets(engine.sets());
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const title = t(`title.${kind}`);
  if (failed || !sets) {
    return (
      <div className="screen lim lim--plain">
        <BackHeader title={title} />
        <p className="lim-empty">{t(failed ? "setup.failed" : "setup.loading")}</p>
      </div>
    );
  }

  const count = players ?? (kind === "draft" ? 8 : 2);
  const packOf = (index: number): string => packs[index] ?? packs[0] ?? sets[0]?.code ?? "";
  const chosen = Array.from({ length: rules.boosters }, (_, index) => (mixed ? packOf(index) : packOf(0)));
  const room = (id: string) => `${profile.base}/limited/events/${id}`;

  const setPack = (index: number, value: string) =>
    setPacks((previous) => {
      const next = Array.from({ length: rules.boosters }, (_, i) => previous[i] ?? null);
      next[index] = value;
      return next;
    });

  const start = async () => {
    setBusy(true);
    try {
      const engine = await profile.engine();
      const settings: LimitedSettings = {
        kind,
        packs: chosen,
        players: [
          { name: lobby.name ?? tPlay("lobby.you"), bot: null },
          ...Array.from({ length: count - 1 }, (_, index) => ({
            name: tPlay("lobby.botName", { number: index + 1 }),
            bot: level,
          })),
        ],
      };
      // Le moteur ouvre les boosters ici : il refuse des réglages qu'il ne sait pas tenir.
      const event = engine.create(settings, Math.floor(Math.random() * 2 ** 31) + 1);
      const record = JSON.parse(event.record()) as LimitedRecord;
      event.free();
      writeLimitedSave({ record }, profile.storageKey);
      navigate(`${profile.base}/limited`, { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "error");
      setBusy(false);
    }
  };

  const createOnline = async () => {
    setBusy(true);
    const result = await createLimitedEvent(game, { kind, packs: chosen, players: count, timers });
    if (result.ok) {
      navigate(room(result.id), { replace: true });
      return;
    }
    toast(errorText(result.error), "error");
    setBusy(false);
  };

  const joinCode = eventCode(code);

  const places: { key: Where; icon: ReactNode; title: string; hint: string }[] = [
    { key: "ai", icon: <BotIcon size={16} />, title: t("setup.whereAi"), hint: t("setup.whereAiHint") },
    { key: "online", icon: <GlobeIcon size={16} />, title: tPlay("lobby.online"), hint: t("setup.whereOnlineHint") },
  ];

  const delaySelect = (label: string, values: number[], value: number, onChange: (next: number) => void) => (
    <label className="lim-col lim-grow">
      <span className="lim-label">{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {values.map((seconds) => (
          <option key={seconds} value={seconds}>
            {delayLabel(seconds)}
          </option>
        ))}
      </select>
    </label>
  );

  const playersBlock = (hint: string) => (
    <div className="lim-col">
      <span className="lim-label">{t("setup.players")}</span>
      <div className="lim-seg" role="group" aria-label={t("setup.players")}>
        {TABLE_SIZES.map((size) => (
          <button key={size} type="button" aria-pressed={count === size} onClick={() => setPlayers(size)}>
            {size}
          </button>
        ))}
      </div>
      <p className="muted lim-small">{hint}</p>
    </div>
  );

  const setSelect = (index: number, label: string) => (
    <select aria-label={label} value={packOf(index)} onChange={(event) => setPack(index, event.target.value)}>
      {sets.map((set) => (
        <option key={set.code} value={set.code}>
          {set.name} ({set.code})
        </option>
      ))}
    </select>
  );

  return (
    <div className={`screen lim${where === "ai" ? "" : " lim--plain"}`}>
      <BackHeader title={title} />

      <section className="lim-panel">
        <h2 className="lim-title">{t("setup.boostersTitle")}</h2>
        <p className="muted lim-small">
          {t(`${profile.words}.${kind === "draft" ? "boostersDraft" : "boostersSealed"}`, {
            boosters: rules.boosters,
            size: rules.packSize,
            min: rules.minMain,
          })}
        </p>
        {mixed ? (
          <ol className="lim-packs">
            {chosen.map((_, index) => (
              <li key={index} className="lim-col">
                <span className="muted lim-small">{t("setup.booster", { number: index + 1 })}</span>
                {setSelect(index, t("setup.booster", { number: index + 1 }))}
              </li>
            ))}
          </ol>
        ) : (
          setSelect(0, t("setup.set"))
        )}
        {/* Une seule extension : rien à mêler. */}
        {sets.length > 1 && <Toggle checked={mixed} onChange={setMixed} label={t("setup.mixed")} hint={t("setup.mixedHint")} />}
      </section>

      <section className="lim-panel">
        <h2 className="lim-title">{t("setup.whoTitle")}</h2>
        <div className="lim-where">
          {places.map((place) => (
            <button key={place.key} type="button" aria-pressed={where === place.key} onClick={() => setWhere(place.key)}>
              <b>
                {place.icon}
                {place.title}
              </b>
              <span className="muted lim-small">{place.hint}</span>
            </button>
          ))}
        </div>

        {where === "ai" && (
          <>
            {playersBlock(t(kind === "draft" ? "setup.playersDraft" : "setup.playersSealed", { bots: count - 1 }))}
            <div className="lim-col">
              <span className="lim-label">{t("setup.level")}</span>
              <div className="lim-seg" role="group" aria-label={t("setup.level")}>
                {BOT_LEVELS.map((value) => (
                  <button key={value} type="button" aria-pressed={level === value} onClick={() => setLevel(value)}>
                    {tPlay(`level.${value}`)}
                  </button>
                ))}
              </div>
              <p className="muted lim-small">{t("setup.levelHint")}</p>
            </div>
            <p className="muted lim-small">{t("setup.oneMatch")}</p>
          </>
        )}

        {where === "online" &&
          (!lobby.online ? (
            <p className="muted">{tPlay("lobby.offline")}</p>
          ) : !lobby.signedIn ? (
            <div className="lim-row">
              <span className="muted lim-grow">{t("setup.signIn")}</span>
              <Link to="/login" className="btn btn--outline">
                {tPlay("lobby.signIn")}
              </Link>
            </div>
          ) : (
            <>
              {mine.length > 0 && (
                <ul className="lim-col" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {mine.map((event) => (
                    <li key={event.id} className="lim-seat-row">
                      <b>{t(`room.title.${event.kind}`)}</b>
                      <span className="muted lim-small">
                        {t(event.status === "waiting" ? "setup.mineWaiting" : "setup.minePlaying", {
                          players: event.seats.length,
                        })}
                      </span>
                      <Link to={room(event.id)} className="btn btn--outline">
                        {t("setup.mineOpen")}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {lobby.canHost ? (
                <>
                  {playersBlock(t("setup.playersOnline"))}
                  <div className="lim-col">
                    <div className="lim-row">
                      {kind === "draft" &&
                        delaySelect(t("setup.pickDelay"), PICK_DELAYS, timers.pick, (pick) => setTimers({ ...timers, pick }))}
                      {delaySelect(t("setup.buildDelay"), BUILD_DELAYS, timers.build, (build) => setTimers({ ...timers, build }))}
                    </div>
                    <p className="muted lim-small">{t("setup.timersHint")}</p>
                  </div>
                  <p className="muted lim-small">{t("setup.oneMatchOnline")}</p>
                  <button type="button" className="btn btn--grad btn--block" disabled={busy} onClick={() => void createOnline()}>
                    {t("setup.create")}
                  </button>
                </>
              ) : (
                // Pas de lien d'achat dans l'app : l'abonnement se prend sur joutes.app.
                <div className="play-upsell">
                  <b>{tPlay("upsell.host.title")}</b>
                  <p className="muted play-small">{tPlay("upsell.host.body")}</p>
                </div>
              )}
              <label className="lim-col">
                <span className="lim-label">{t("setup.join")}</span>
                <div className="lim-row">
                  <input
                    className="play-input lim-grow"
                    value={code}
                    autoCapitalize="off"
                    autoCorrect="off"
                    onChange={(event) => setCode(event.target.value)}
                    placeholder={t("setup.joinPlaceholder")}
                  />
                  <button
                    type="button"
                    className="btn btn--outline"
                    disabled={!/^[a-z0-9]{4,32}$/.test(joinCode)}
                    onClick={() => navigate(room(joinCode))}
                  >
                    {t("setup.joinButton")}
                  </button>
                </div>
              </label>
            </>
          ))}
      </section>

      {where === "ai" && (
        <div className="lim-bar">
          <button type="button" className="btn btn--grad" disabled={busy} onClick={() => void start()}>
            {t(kind === "draft" ? "setup.startDraft" : "setup.startSealed")}
          </button>
        </div>
      )}
      {where === "ai" && replaces && <p className="muted lim-small">{t("setup.replaces")}</p>}
      {node}
    </div>
  );
}
