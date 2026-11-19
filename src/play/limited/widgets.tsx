import "./limited.css";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { TableCard } from "../../engine/cards";
import { DOMAIN_COLORS, type Domain, type LimitedKind, type LimitedView } from "../../engine/limited";
import type { CardFace, Faces } from "../../engine/limited-faces";
import { AlertIcon, BackIcon, CheckIcon, CloseIcon, SearchIcon, TimerIcon } from "../icons";
import { usePlayT } from "../t";
import { Sheet } from "../ui";

/**
 * Les pièces des écrans de scellé et de draft, les mêmes que sur le site
 * (`components/play/limited/limited-kit.tsx` de joutes-app), dessinées pour un
 * téléphone : une carte se lit dans une feuille, les actions tiennent une barre
 * au bas de l'écran.
 */

/** La pastille d'un domaine ou d'un aspect. */
export function Dot({ color }: { color: string }) {
  return <span aria-hidden className="lim-dot" style={{ background: color }} />;
}

export function DomainDot({ domain }: { domain: Domain }) {
  return <Dot color={DOMAIN_COLORS[domain]} />;
}

/** Les pastilles des groupes d'une carte. */
export function FaceDots({ face, faces }: { face: CardFace | undefined; faces: Faces }) {
  return (
    <span className="lim-dots">
      {faces.groups
        .filter((group) => face?.groups.includes(group.key))
        .map((group) => (
          <Dot key={group.key} color={group.color} />
        ))}
    </span>
  );
}

type LimitedCardProps = {
  code: string;
  faces: Faces;
  foil?: boolean;
  /** Atténuée : hors de l'identité du deck. */
  dim?: boolean;
  selected?: boolean;
  /** Nombre d'exemplaires, affiché à partir de deux. */
  count?: number;
  /** Une ligne sous la carte. */
  note?: ReactNode;
  /** Ce que fait un toucher, dit aux lecteurs d'écran. */
  label?: string;
  onClick?: () => void;
  onInspect?: () => void;
  /** Entoure les rares et mieux de leur couleur (ouverture d'un booster). */
  showRarity?: boolean;
};

/** Une carte d'un booster, d'une réserve ou d'un deck : son illustration, ou son nom à défaut. */
export function LimitedCard({
  code,
  faces,
  foil = false,
  dim = false,
  selected = false,
  count = 1,
  note,
  label,
  onClick,
  onInspect,
  showRarity = false,
}: LimitedCardProps) {
  const t = usePlayT("Limited");
  const card = faces.get(code);
  const name = faces.name(code);
  const ring = showRarity ? (card?.ring ?? null) : null;
  const face = (
    <span
      className={`lim-card__face${card?.landscape ? " lim-card__face--wide" : ""}${dim ? " lim-card__face--dim" : ""}${selected ? " lim-card__face--on" : ""}`}
      style={ring && !selected ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
    >
      {card?.image ? (
        <img src={card.image} alt="" loading="lazy" draggable={false} />
      ) : (
        // Sans illustration au catalogue : le nom, le coût et les groupes suffisent à choisir.
        <span className="lim-card__blank">
          <span>
            <span>{card?.main && card.cost !== null ? card.cost : ""}</span>
            <FaceDots face={card} faces={faces} />
          </span>
          <b>{name}</b>
          <span className="muted">{card?.kind ?? ""}</span>
        </span>
      )}
      {foil && (
        <span className="lim-card__foil" title={t("foil")} aria-label={t("foil")}>
          ✦
        </span>
      )}
      {count > 1 && <span className="lim-card__count">×{count}</span>}
    </span>
  );
  return (
    <span className="lim-card">
      {onClick ? (
        <button
          type="button"
          className="lim-card__tap"
          aria-label={label ?? name}
          aria-pressed={selected || undefined}
          onClick={onClick}
        >
          {face}
        </button>
      ) : (
        face
      )}
      {onInspect && (
        <button type="button" className="lim-card__zoom" aria-label={t("inspect", { name })} onClick={onInspect}>
          <SearchIcon size={15} />
        </button>
      )}
      {note && <span className="lim-card__note">{note}</span>}
    </span>
  );
}

/** La ligne d'une carte, avec « Brillante » pour un exemplaire brillant. */
export function useFaceLine(): (face: CardFace | undefined, foil?: boolean) => string {
  const t = usePlayT("Limited");
  return (face, foil = false) => (!face ? "" : foil ? `${face.line} · ${t("foil")}` : face.line);
}

/** Une carte en grand, avec son texte, dans une feuille. */
export function CardZoom({
  code,
  foil = false,
  faces,
  onClose,
  action,
}: {
  code: string | null;
  foil?: boolean;
  faces: Faces;
  onClose: () => void;
  /** Un bouton sous le texte (« Prendre cette carte »). */
  action?: ReactNode;
}) {
  const t = usePlayT("Limited");
  const line = useFaceLine();
  if (code === null) return null;
  const card = faces.get(code);
  return (
    <Sheet title={faces.name(code)} onClose={onClose} theme="app">
      <div className="lim-zoom">
        <p className="muted lim-small">{line(card, foil)}</p>
        {card?.image && <img src={card.image} alt="" className={card.landscape ? "lim-zoom__wide" : undefined} />}
        {card?.text ? <p className="lim-zoom__text">{card.text}</p> : <p className="muted">{t("noText")}</p>}
        {action}
      </div>
    </Sheet>
  );
}

/** La courbe des coûts : huit colonnes, la dernière pour 7 et plus. */
export function CostCurve({ curve }: { curve: number[] }) {
  const t = usePlayT("Limited");
  const top = Math.max(1, ...curve);
  return (
    <div
      role="img"
      className="lim-curve"
      aria-label={t("curveLabel", { list: curve.map((count, cost) => `${cost === 7 ? "7+" : cost} : ${count}`).join(", ") })}
    >
      {curve.map((count, cost) => (
        <div key={cost}>
          <span>{count > 0 ? count : ""}</span>
          <i
            className={count > 0 ? "lim-curve__bar" : undefined}
            style={{ height: count > 0 ? `${Math.round((count / top) * 60) + 8}%` : "3px" }}
          />
          <span>{cost === 7 ? "7+" : cost}</span>
        </div>
      ))}
    </div>
  );
}

/** Le nombre de cartes de chaque domaine ou aspect, en pastilles. */
export function GroupCounts({ counts, faces }: { counts: Record<string, number>; faces: Faces }) {
  return (
    <div className="lim-groups">
      {faces.groups
        .filter((group) => (counts[group.key] ?? 0) > 0)
        .map((group) => (
          <span key={group.key}>
            <Dot color={group.color} />
            {group.label} <strong>{counts[group.key]}</strong>
          </span>
        ))}
    </div>
  );
}

export type EventStep = "open" | "build" | "match";

/** Le bandeau d'un évènement : son nom, où on en est, et la sortie. */
export function EventHeader({
  title,
  subtitle,
  kind,
  step,
  onBack,
  onQuit,
  quitBody,
  children,
}: {
  title: string;
  subtitle: string;
  kind: LimitedKind;
  step: EventStep;
  /** Revenir à l'accueil sans rien perdre : l'évènement y attend. */
  onBack: () => void;
  onQuit: () => void;
  /** Ce que quitter fait perdre, quand ce n'est pas l'évènement gardé sur l'appareil. */
  quitBody?: string;
  /** Ce qui s'affiche à droite du titre (le temps restant). */
  children?: ReactNode;
}) {
  const t = usePlayT("Limited");
  const { t: th } = useTranslation();
  const [asking, setAsking] = useState(false);
  const steps: { key: EventStep; label: string }[] = [
    { key: "open", label: t(kind === "draft" ? "step.draft" : "step.open") },
    { key: "build", label: t("step.build") },
    { key: "match", label: t("step.match") },
  ];
  return (
    <header className="lim-head">
      <div className="lim-head__top">
        <button type="button" className="back-header__button" aria-label={th("common.back")} onClick={onBack}>
          <BackIcon size={20} />
        </button>
        <div className="lim-head__titles">
          <span className="lim-head__title">{title}</span>
          <span className="muted lim-small">{subtitle}</span>
        </div>
        {children}
        <button type="button" className="btn btn--ghost" onClick={() => setAsking(true)}>
          {t("quit")}
        </button>
      </div>
      <ol className="lim-steps">
        {steps.map(({ key, label }, index) => (
          <li key={key} aria-current={key === step ? "step" : undefined} className={`lim-step${key === step ? " lim-step--on" : ""}`}>
            {index + 1} · {label}
          </li>
        ))}
      </ol>
      {asking && (
        <Sheet title={t("quitTitle")} onClose={() => setAsking(false)} theme="app">
          <div className="lim-col" style={{ gap: "0.8rem" }}>
            <p className="muted">{quitBody ?? t("quitBody")}</p>
            <button type="button" className="btn btn--danger btn--block" onClick={onQuit}>
              {t("quitConfirm")}
            </button>
            <button type="button" className="btn btn--outline btn--block" onClick={() => setAsking(false)}>
              {t("quitCancel")}
            </button>
          </div>
        </Sheet>
      )}
    </header>
  );
}

/** Les joueurs de l'évènement et où chacun en est. */
export function SeatStrip({
  view,
  seat,
  away = [],
}: {
  view: Pick<LimitedView, "seats" | "phase">;
  seat: number;
  away?: number[];
}) {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  return (
    <ul className="lim-seats">
      {view.seats.map((player, index) => {
        const state = player.out
          ? t("seat.out")
          : away.includes(index) && !player.bot
            ? t("seat.away")
            : view.phase === "draft"
              ? player.waiting > 0
                ? t("seat.picking")
                : t("seat.waiting")
              : player.ready
                ? t("seat.ready")
                : t("seat.building");
        const busy = !player.out && (view.phase === "draft" ? player.waiting > 0 : !player.ready);
        return (
          <li key={index} className={`lim-seat${index === seat ? " lim-seat--me" : ""}`}>
            <span className="lim-seat__name">
              <span aria-hidden className={`lim-led${busy ? " lim-led--busy" : ""}`} />
              <span>{player.name}</span>
              {index === seat && <span className="lim-badge">{tPlay("lobby.youBadge")}</span>}
            </span>
            <span className="lim-seat__state">{player.bot ? `${tPlay(`level.${player.bot}`)} · ${state}` : state}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Les cartes qui entrent dans un deck principal (ni Légende, ni champ de bataille, ni rune). */
export function isMainCard(card: TableCard | undefined): boolean {
  return card !== undefined && (card.kind === "unit" || card.kind === "spell" || card.kind === "gear");
}

/** Une place du deck qui ne tient qu'une carte : la Légende, un champ de bataille, le leader. */
export function Slot({
  name,
  empty,
  onInspect,
  onRemove,
  removeLabel,
}: {
  name: string;
  empty: boolean;
  onInspect?: () => void;
  onRemove?: () => void;
  removeLabel: string;
}) {
  const t = usePlayT("Limited");
  return (
    <span className={`lim-slot${empty ? " lim-slot--empty" : ""}`}>
      <span>{name}</span>
      {onInspect && (
        <button type="button" className="lim-icon" aria-label={t("inspect", { name })} onClick={onInspect}>
          <SearchIcon size={15} />
        </button>
      )}
      {onRemove && (
        <button type="button" className="lim-icon" aria-label={removeLabel} onClick={onRemove}>
          <CloseIcon size={15} />
        </button>
      )}
    </span>
  );
}

/** Une ligne du deck principal : un toucher retire un exemplaire. */
export function DeckRow({
  code,
  count,
  name,
  faces,
  badge,
  cost,
  removeLabel,
  onRemove,
  onInspect,
}: {
  code: string;
  count: number;
  name: string;
  faces: Faces;
  badge?: string;
  /** Ce qui s'affiche à droite à la place du coût de la carte (un coût avec pénalité). */
  cost?: ReactNode;
  removeLabel: string;
  onRemove: () => void;
  onInspect: () => void;
}) {
  const t = usePlayT("Limited");
  const card = faces.get(code);
  return (
    <li>
      <button type="button" className="lim-line" aria-label={removeLabel} onClick={onRemove}>
        <span className="lim-line__count">×{count}</span>
        <FaceDots face={card} faces={faces} />
        <span className="lim-line__name">{name}</span>
        {badge && <span className="lim-badge">{badge}</span>}
        <span className="lim-line__cost">{cost ?? card?.cost ?? ""}</span>
      </button>
      <button type="button" className="lim-icon" aria-label={t("inspect", { name })} onClick={onInspect}>
        <SearchIcon size={15} />
      </button>
    </li>
  );
}

/** Ce que le moteur reproche au deck, ou « Deck légal ». */
export function DeckProblems({ problems }: { problems: string[] }) {
  const t = usePlayT("Limited");
  return (
    <section className="lim-panel" aria-live="polite">
      <h2 className="lim-title lim-row">
        {problems.length === 0 ? <CheckIcon size={16} className="lim-ok" /> : <AlertIcon size={16} className="lim-warn" />}
        {t(problems.length === 0 ? "build.legal" : "build.problems", { count: problems.length })}
      </h2>
      {problems.length > 0 && (
        <ul className="lim-problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p className="muted lim-small">{t("build.checked")}</p>
    </section>
  );
}

/** Le temps qu'il me reste pour choisir ou construire ; rien sans délai. */
export function Countdown({ deadline }: { deadline: number | null }) {
  const t = usePlayT("Limited");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [deadline]);
  if (deadline === null || now === null) return null;
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <span role="timer" aria-label={t("online.timeLeft", { time: text })} className={`lim-clock${left <= 10 ? " lim-clock--late" : ""}`}>
      <TimerIcon size={15} style={{ marginRight: "0.3rem" }} />
      {text}
    </span>
  );
}

/** La barre d'action d'un écran, au bas de l'écran. */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="lim-bar">{children}</div>;
}
