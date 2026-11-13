import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { searchCards } from "../api/cards";
import type { Card, CardOrientation } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { CardImage } from "../components/CardImage";
import {
  CrossIcon,
  FlameIcon,
  MinusIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
} from "../components/icons";

/**
 * Suivi de partie Riftbound : points, énergie et puissance de 2 à 4 joueurs,
 * avec la légende de chacun. C'est le même outil de table que la page
 * `/games/riftbound/tracker` du site, entièrement local : rien ne part au
 * serveur, et la partie survit à la fermeture de l'app.
 */

const STORAGE_KEY = "riftbound-tracker-state";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

interface TrackerLegend {
  id: string;
  name: string;
  image?: string;
  orientation?: CardOrientation;
}

interface TrackerPlayer {
  id: string;
  name: string;
  score: number;
  energy: number;
  power: number;
  legend: TrackerLegend | null;
}

function newPlayer(): TrackerPlayer {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    score: 0,
    energy: 0,
    power: 0,
    legend: null,
  };
}

function isValidPlayers(value: unknown): value is TrackerPlayer[] {
  return (
    Array.isArray(value) &&
    value.length >= MIN_PLAYERS &&
    value.length <= MAX_PLAYERS &&
    value.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.score === "number" &&
        typeof p.energy === "number" &&
        typeof p.power === "number",
    )
  );
}

function loadPlayers(): TrackerPlayer[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (isValidPlayers(parsed)) {
      return parsed.map((p) => ({ ...p, legend: p.legend ?? null }));
    }
  } catch {
    // Stockage illisible ou indisponible : on repart d'une table vide.
  }
  return [newPlayer(), newPlayer()];
}

export function TrackerScreen() {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<TrackerPlayer[]>(loadPlayers);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    } catch {
      // Stockage indisponible : la partie vit le temps de l'écran.
    }
  }, [players]);

  const update = (id: string, patch: Partial<TrackerPlayer>) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPlayer = () =>
    setPlayers((prev) => (prev.length >= MAX_PLAYERS ? prev : [...prev, newPlayer()]));

  const removePlayer = (id: string) =>
    setPlayers((prev) => (prev.length <= MIN_PLAYERS ? prev : prev.filter((p) => p.id !== id)));

  const reset = () => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0, energy: 0, power: 0 })));
    setConfirmReset(false);
  };

  return (
    <div className="screen">
      <BackHeader title={t("tracker.title")} />
      <p className="screen-subtitle">{t("tracker.description")}</p>

      <div className="tracker-actions">
        <button
          type="button"
          className="btn btn--outline"
          onClick={addPlayer}
          disabled={players.length >= MAX_PLAYERS}
        >
          <PlusIcon size={16} />
          {t("tracker.addPlayer")}
        </button>
        {confirmReset ? (
          <div className="tracker-confirm" role="alertdialog" aria-label={t("tracker.resetConfirm")}>
            <span className="muted">{t("tracker.resetConfirm")}</span>
            <button type="button" className="btn btn--danger" onClick={reset}>
              {t("tracker.resetAction")}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--outline" onClick={() => setConfirmReset(true)}>
            <RefreshIcon size={16} />
            {t("tracker.reset")}
          </button>
        )}
      </div>

      <div className="tracker-grid">
        {players.map((player, index) => (
          <section key={player.id} className="card tracker-player">
            <div className="tracker-player__head">
              <input
                type="text"
                value={player.name}
                onChange={(e) => update(player.id, { name: e.currentTarget.value })}
                placeholder={t("tracker.defaultName", { number: index + 1 })}
                aria-label={t("tracker.nameLabel", { number: index + 1 })}
                className="tracker-player__name"
              />
              {players.length > MIN_PLAYERS && (
                <button
                  type="button"
                  className="tracker-icon-btn"
                  onClick={() => removePlayer(player.id)}
                  aria-label={t("tracker.removePlayer")}
                >
                  <CrossIcon size={16} />
                </button>
              )}
            </div>

            <LegendPicker
              value={player.legend}
              onChange={(legend) => update(player.id, { legend })}
            />

            <Counter
              label={t("tracker.score")}
              value={player.score}
              onChange={(score) => update(player.id, { score })}
              large
            />
            <div className="tracker-player__small">
              <Counter
                label={t("tracker.energy")}
                icon={<SparklesIcon size={12} />}
                value={player.energy}
                onChange={(energy) => update(player.id, { energy })}
              />
              <Counter
                label={t("tracker.power")}
                icon={<FlameIcon size={12} />}
                value={player.power}
                onChange={(power) => update(player.id, { power })}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  icon,
  large,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon?: ReactNode;
  large?: boolean;
}) {
  return (
    <div className={`tracker-counter${large ? " tracker-counter--large" : ""}`}>
      <span className="tracker-counter__label">
        {icon}
        {label}
      </span>
      <div className="tracker-counter__row">
        <button
          type="button"
          className="tracker-counter__btn"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`-1 ${label}`}
        >
          <MinusIcon size={large ? 22 : 16} />
        </button>
        <span className="tracker-counter__value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="tracker-counter__btn"
          onClick={() => onChange(value + 1)}
          aria-label={`+1 ${label}`}
        >
          <PlusIcon size={large ? 22 : 16} />
        </button>
      </div>
    </div>
  );
}

/** Recherche d'une légende dans le catalogue Riftbound (hors ligne si exporté). */
function LegendPicker({
  value,
  onChange,
}: {
  value: TrackerLegend | null;
  onChange: (legend: TrackerLegend | null) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length <= 1) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchCards("riftbound", { searchQuery: q, type: "Legend", setCode: "*", lang: "all", limit: 10 })
        .then((res) => {
          if (!cancelled) setResults(res.cards.slice(0, 10));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="tracker-legend">
        <CardImage src={value.image} orientation={value.orientation} alt="" className="tracker-legend__img" />
        <span className="tracker-legend__name">{value.name}</span>
        <button
          type="button"
          className="tracker-icon-btn"
          onClick={() => onChange(null)}
          aria-label={t("tracker.clearLegend")}
        >
          <CrossIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="tracker-legend-search">
      <label className="tracker-legend-search__field">
        <SearchIcon size={14} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder={t("tracker.legendPlaceholder")}
          aria-label={t("tracker.legend")}
        />
      </label>
      {searching && <p className="muted tracker-legend-search__hint">{t("common.loading")}</p>}
      {!searching && results && results.length === 0 && (
        <p className="muted tracker-legend-search__hint">{t("tracker.legendEmpty")}</p>
      )}
      {results && results.length > 0 && (
        <ul className="tracker-legend-search__list">
          {results.map((card) => (
            <li key={`${card.id}-${card.setCode}-${card.collectorNumber}`}>
              <button
                type="button"
                className="tracker-legend-search__item"
                onClick={() => {
                  onChange({ id: card.id, name: card.name, image: card.image, orientation: card.orientation });
                  setQuery("");
                  setResults(null);
                }}
              >
                <CardImage src={card.image} orientation={card.orientation} alt="" className="tracker-legend__img" loading="lazy" />
                <span className="tracker-legend__name">
                  {card.name}
                  <span className="muted"> · {card.setCode} #{card.collectorNumber}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
