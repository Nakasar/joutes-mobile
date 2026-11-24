import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "./i18n";
import { Dices, History, Loader2, LogOut, RotateCcw, Search, Undo2, X } from "./icons";

import {
  companionStorageKey,
  parseStoredCompanion,
  serializeCompanion,
  undo as undoState,
  undoable,
  withUndo,
  type CompanionCard,
  type CompanionGame,
  type CompanionLogEntry,
  type CompanionState,
  type Undoable,
} from "./state";
import { searchCards } from "../api/cards";
import { fetchCompanionDecks, type CompanionDeck } from "./decks";
import { cn } from "./cn";

import "./utilities.css";
import "./companion.css";

/* Les polices du compagnon (Cinzel, Cormorant Garamond) viennent de la feuille Google Fonts de l'app : voir `companion.css`. */
export const companionFonts = "";

/* ------------------------------------------------------------------ */
/* État enregistré                                                    */
/* ------------------------------------------------------------------ */

/**
 * L'état d'une partie, relu au montage puis enregistré à chaque changement :
 * un rechargement ou une app fermée en pleine partie ne perd rien.
 *
 * Le premier rendu part toujours d'un état neuf, comme celui du serveur ; la
 * partie enregistrée ne remplace qu'ensuite, pour que l'hydratation concorde.
 */
export function useCompanion<T extends CompanionState>(
  game: CompanionGame,
  create: () => T,
  migrate?: () => T | null,
) {
  const [state, setState] = useState<Undoable<T>>(() => undoable(create()));
  const [hydrated, setHydrated] = useState(false);
  const createRef = useRef(create);
  const migrateRef = useRef(migrate);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(companionStorageKey(game));
      const parsed = raw ? parseStoredCompanion(game, JSON.parse(raw)) : null;
      if (parsed) {
        setState(parsed as Undoable<T>);
      } else {
        const migrated = migrateRef.current?.();
        if (migrated) setState(undoable(migrated));
      }
    } catch {
      // Stockage illisible ou indisponible : on repart d'une table vide.
    }
    setHydrated(true);
  }, [game]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(companionStorageKey(game), serializeCompanion(state));
    } catch {
      // Navigation privée : la partie vit le temps de la page.
    }
  }, [game, hydrated, state]);

  /** Une action de jeu : elle s'annule. */
  const play = useCallback((fn: (s: T) => T) => setState((prev) => withUndo(prev, fn(prev.present))), []);
  /** Un réglage de préparation : il ne s'empile pas dans « Annuler ». */
  const edit = useCallback((fn: (s: T) => T) => setState((prev) => ({ ...prev, present: fn(prev.present) })), []);
  const undo = useCallback(() => setState((prev) => undoState(prev)), []);
  const reset = useCallback(() => setState(undoable(createRef.current())), []);

  return { state: state.present, canUndo: state.past.length > 0, hydrated, play, edit, undo, reset };
}

/** Garde l'écran allumé tant que la partie est à l'écran, là où le navigateur le permet. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const next = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Refusé (économie d'énergie, onglet caché) : l'écran s'éteindra seul.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Bloque le défilement de la page derrière la table plein écran. */
export function useLockedScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Places à table                                                     */
/* ------------------------------------------------------------------ */

type SeatPlace = { area: string; turn: number; side: boolean };

/**
 * Où s'assoit chacun autour du téléphone posé à plat. Le joueur 1 est en bas,
 * les suivants tournent dans le sens des aiguilles d'une montre ; chaque place
 * regarde son joueur (retournée en face, de côté sur les bords).
 */
function seatLayout(count: number, band: boolean): { style: CSSProperties; seats: SeatPlace[] } {
  if (count <= 2) {
    return {
      style: {
        gridTemplateRows: band ? "minmax(0, 1fr) auto minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
        gridTemplateAreas: band ? '"s1" "hub" "s0"' : '"s1" "s0"',
      },
      seats: [
        { area: "s0", turn: 0, side: false },
        { area: "s1", turn: 180, side: false },
      ],
    };
  }
  const cols = { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" };
  if (count === 3) {
    return {
      style: { ...cols, gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)", gridTemplateAreas: '"s1 s1" "s0 s2"' },
      seats: [
        { area: "s0", turn: 90, side: true },
        { area: "s1", turn: 180, side: false },
        { area: "s2", turn: -90, side: true },
      ],
    };
  }
  if (count === 4) {
    return {
      style: { ...cols, gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)", gridTemplateAreas: '"s1 s2" "s0 s3"' },
      seats: [
        { area: "s0", turn: 90, side: true },
        { area: "s1", turn: 90, side: true },
        { area: "s2", turn: -90, side: true },
        { area: "s3", turn: -90, side: true },
      ],
    };
  }
  if (count === 5) {
    return {
      style: { ...cols, gridTemplateRows: "repeat(3, minmax(0, 1fr))", gridTemplateAreas: '"s2 s3" "s1 s4" "s0 s0"' },
      seats: [
        { area: "s0", turn: 0, side: false },
        { area: "s1", turn: 90, side: true },
        { area: "s2", turn: 90, side: true },
        { area: "s3", turn: -90, side: true },
        { area: "s4", turn: -90, side: true },
      ],
    };
  }
  return {
    style: { ...cols, gridTemplateRows: "repeat(3, minmax(0, 1fr))", gridTemplateAreas: '"s2 s3" "s1 s4" "s0 s5"' },
    seats: [
      { area: "s0", turn: 90, side: true },
      { area: "s1", turn: 90, side: true },
      { area: "s2", turn: 90, side: true },
      { area: "s3", turn: -90, side: true },
      { area: "s4", turn: -90, side: true },
      { area: "s5", turn: -90, side: true },
    ],
  };
}

/**
 * La table plein écran. À deux, la bande commune (`hub`) se glisse entre les
 * joueurs ; à plus, elle devient un bouton rond au centre.
 */
export function CompanionTable({
  theme,
  count,
  band,
  hub,
  seat,
  className,
  children,
}: {
  theme: "rb" | "swu" | "mtg";
  count: number;
  /** Une bande commune entre deux joueurs plutôt qu'un bouton au centre. */
  band: boolean;
  hub: ReactNode;
  seat: (index: number) => ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const withBand = band && count <= 2;
  const layout = seatLayout(count, withBand);
  return (
    <div
      className={cn("cmp cmp-screen", `cmp-${theme}`, companionFonts, className)}
      style={layout.style}
      role="application"
    >
      {layout.seats.slice(0, count).map((place, index) => (
        <section
          key={place.area}
          className="cmp-seat"
          data-side={place.side ? "true" : "false"}
          style={{ gridArea: place.area }}
        >
          <div className="cmp-seat-inner" style={{ ["--turn" as string]: `${place.turn}deg` }}>
            {seat(index)}
          </div>
        </section>
      ))}
      {withBand ? <div style={{ gridArea: "hub" }} className="cmp-hub">{hub}</div> : <div className="cmp-hub-float">{hub}</div>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recherche de cartes et decks                                       */
/* ------------------------------------------------------------------ */

type SearchHit = {
  id: string;
  name: string;
  image?: string;
  backImage?: string;
  orientation?: "portrait" | "landscape";
  hp?: number;
  setCode?: string;
  collectorNumber?: string;
  subtitle?: string;
};

/** Cherche une carte d'un type donné dans le catalogue du jeu. */
export function CardSearch({
  game,
  type,
  placeholder,
  label,
  onPick,
}: {
  game: CompanionGame;
  type?: string;
  placeholder: string;
  label: string;
  onPick: (card: CompanionCard) => void;
}) {
  const t = useTranslations("Games.Companion");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Avec `limit`, la recherche répond par page ; elle marche aussi hors ligne.
        const res = await searchCards(game, { searchQuery: q, setCode: "*", lang: "all", type, limit: 36 });
        const data: unknown = res.cards;
        // Une carte réimprimée revient une fois par impression : on n'en garde
        // qu'une par nom, la première, pour une liste où chaque ligne compte.
        const seen = new Set<string>();
        const unique = (Array.isArray(data) ? (data as SearchHit[]) : []).filter((hit) => {
          if (seen.has(hit.name)) return false;
          seen.add(hit.name);
          return true;
        });
        if (!cancelled) setHits(unique.slice(0, 12));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [game, query, type]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setHits(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Une même carte existe en plusieurs impressions : une ligne par nom suffit.
  const unique = hits ? [...new Map(hits.map((h) => [h.name, h])).values()] : null;

  return (
    <div className="cmp-search" ref={boxRef}>
      <label className="cmp-search-field">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      </label>
      {unique && (
        <div className="cmp-results" role="listbox" aria-label={label}>
          {unique.length === 0 && <p className="p-3 text-sm cmp-muted">{t("noCard")}</p>}
          {unique.map((hit) => (
            <button
              key={`${hit.id}-${hit.setCode}-${hit.collectorNumber}`}
              type="button"
              role="option"
              aria-selected="false"
              className="cmp-result"
              onClick={() => {
                onPick({
                  id: hit.id,
                  name: hit.name,
                  ...(hit.image ? { image: hit.image } : {}),
                  ...(hit.backImage ? { backImage: hit.backImage } : {}),
                  ...(hit.orientation ? { orientation: hit.orientation } : {}),
                  ...(typeof hit.hp === "number" ? { hp: hit.hp } : {}),
                });
                setQuery("");
                setHits(null);
              }}
            >
              {hit.image ? <img src={hit.image} alt="" loading="lazy" /> : <span className="h-10 w-10" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{hit.name}</span>
                <span className="block text-xs cmp-muted">
                  {hit.setCode} #{hit.collectorNumber}
                  {typeof hit.hp === "number" ? ` · ${t("hpShort", { hp: hit.hp })}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Les decks du joueur pour ce jeu, chargés une fois ; vide sans compte. */
export function useCompanionDecks(game: CompanionGame) {
  const [decks, setDecks] = useState<CompanionDeck[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchCompanionDecks(game)
      .then((list) => {
        if (!cancelled) setDecks(list);
      })
      .catch(() => {
        if (!cancelled) setDecks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [game]);
  return decks;
}

/** Choisir un de ses decks remplit d'un coup ce qu'il pose sur la table. */
export function DeckSelect({
  decks,
  value,
  onPick,
}: {
  decks: CompanionDeck[] | null;
  value?: string;
  onPick: (deck: CompanionDeck) => void;
}) {
  const t = useTranslations("Games.Companion");
  if (!decks || decks.length === 0) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="cmp-label">{t("fromDeck")}</span>
      <select
        className="cmp-search-field text-sm"
        style={{ background: "transparent", color: "var(--cmp-ink)" }}
        value={decks.some((d) => d.name === value) ? value : ""}
        onChange={(e) => {
          const deck = decks.find((d) => d.name === e.target.value);
          if (deck) onPick(deck);
        }}
      >
        <option value="">{t("chooseDeck")}</option>
        {decks.map((deck) => (
          <option key={deck.id} value={deck.name}>
            {deck.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Une vignette de carte, ou sa place vide. */
export function CardThumb({ card, width, height, className, style }: { card: CompanionCard | null | undefined; width: number; height: number; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn("cmp-card-slot", className)} style={{ width, height, ...style }}>
      {card?.image ? (
        <img src={card.image} alt={card.name} />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Menu de la partie                                                  */
/* ------------------------------------------------------------------ */

function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

/**
 * Le menu de la partie : annuler, dés, journal, recommencer, quitter. Les
 * réglages propres à un jeu s'y glissent en `children`.
 */
export function GameMenu({
  open,
  onClose,
  canUndo,
  onUndo,
  onRestart,
  onExit,
  log,
  turnLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onExit: () => void;
  log: CompanionLogEntry[];
  /** Comment nommer le moment d'une entrée du journal (« Tour 3 », « Round 2 »), ou rien. */
  turnLabel?: (turn: number) => string;
  children?: ReactNode;
}) {
  const t = useTranslations("Games.Companion");
  const [roll, setRoll] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (!open) {
      setRoll(null);
      setConfirmRestart(false);
    }
  }, [open]);

  if (!open) return null;
  const recent = [...log].reverse().slice(0, 30);

  return (
    <div className="cmp-sheet-backdrop" onClick={onClose}>
      <div
        className="cmp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("menu")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="cmp-title text-lg">{t("menu")}</h2>
          <button type="button" className="cmp-round" onClick={onClose} aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="cmp-button" onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" /> {t("undo")}
          </button>
          <button type="button" className="cmp-button" onClick={() => setRoll(t("rolled", { sides: 6, value: rollDie(6) }))}>
            <Dices className="h-4 w-4" /> {t("d6")}
          </button>
          <button type="button" className="cmp-button" onClick={() => setRoll(t("rolled", { sides: 20, value: rollDie(20) }))}>
            <Dices className="h-4 w-4" /> {t("d20")}
          </button>
          <button type="button" className="cmp-button" onClick={() => setRoll(rollDie(2) === 1 ? t("heads") : t("tails"))}>
            {t("coin")}
          </button>
        </div>
        {roll && (
          <p className="cmp-title text-center text-2xl" aria-live="polite">
            {roll}
          </p>
        )}

        {children}

        <div className="flex flex-col gap-1">
          <span className="cmp-label flex items-center gap-1">
            <History className="h-3 w-3" /> {t("log")}
          </span>
          {recent.length === 0 ? (
            <p className="text-sm cmp-muted">{t("logEmpty")}</p>
          ) : (
            <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
              {recent.map((entry, i) => (
                <li key={`${log.length - i}`} className="flex gap-2">
                  {turnLabel && <span className="shrink-0 cmp-muted tabular-nums">{turnLabel(entry.turn)}</span>}
                  <span>{entry.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {confirmRestart ? (
            <>
              <span className="w-full text-sm cmp-muted">{t("restartConfirm")}</span>
              <button type="button" className="cmp-button" onClick={onRestart}>
                <RotateCcw className="h-4 w-4" /> {t("restartAction")}
              </button>
              <button type="button" className="cmp-button" onClick={() => setConfirmRestart(false)}>
                {t("cancel")}
              </button>
            </>
          ) : (
            <button type="button" className="cmp-button" onClick={() => setConfirmRestart(true)}>
              <RotateCcw className="h-4 w-4" /> {t("restart")}
            </button>
          )}
          <button type="button" className="cmp-button" onClick={onExit}>
            <LogOut className="h-4 w-4" /> {t("exit")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Le dernier évènement, rappelé quelques secondes au milieu de la table. */
export function LastEvent({ log, style }: { log: CompanionLogEntry[]; style?: CSSProperties }) {
  const last = log[log.length - 1];
  if (!last) return null;
  return (
    <div key={log.length} className="cmp-toast" style={style} aria-live="polite">
      {last.text}
    </div>
  );
}
