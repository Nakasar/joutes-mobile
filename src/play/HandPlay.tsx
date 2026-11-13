import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import type { TableCard } from "../engine/cards";
import type { RuneUse } from "../engine/payment";
import type { EngineCost, EngineObj } from "../engine/types";
import { DOMAIN_HEX } from "../engine/told-text";

/** Au-delà de cette distance, un appui devient un glisser. */
const DRAG_PX = 8;
/** Au doigt, un appui long prend la carte. */
const LONG_PRESS_MS = 320;

export type DragStart = { card: number; x: number; y: number; pointerId: number };

type HandCardProps = {
  obj: EngineObj;
  /** La carte telle que la table la dessine (une `PlayCard` sans action). */
  children: ReactNode;
  playable: boolean;
  /** « Jouer » a été touché : on attend l'emplacement. */
  armed: boolean;
  onDragStart: (start: DragStart) => void;
};

/**
 * Une carte de la main, comme sur le site (`components/play/HandPlay.tsx`) : un
 * toucher la montre en grand (la `PlayCard` dedans s'en charge, avec le bouton
 * Jouer de l'aperçu), un appui long ou un geste vers le haut la prend, et elle
 * se joue là où on la lâche. Un geste de côté fait défiler la main.
 */
export function HandCard({ obj, children, playable, armed, onDragStart }: HandCardProps) {
  const press = useRef<{ x: number; y: number; id: number; timer: number | null; dragged: boolean } | null>(null);

  const start = (event: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.dragged) return;
    p.dragged = true;
    if (p.timer !== null) window.clearTimeout(p.timer);
    onDragStart({ card: obj.id, x: event.clientX, y: event.clientY, pointerId: p.id });
  };

  return (
    <div
      data-hand-card={obj.id}
      className={`pt-hand-card${playable ? " pt-hand-card--playable" : ""}${armed ? " pt-hand-card--armed" : ""}`}
      onPointerDown={(event) => {
        if (press.current?.timer) window.clearTimeout(press.current.timer);
        press.current = null;
        if (!playable || event.button !== 0) return;
        const id = event.pointerId;
        press.current = { x: event.clientX, y: event.clientY, id, timer: null, dragged: false };
        if (event.pointerType === "touch") {
          const { clientX, clientY } = event;
          press.current.timer = window.setTimeout(() => {
            const p = press.current;
            if (!p || p.dragged) return;
            p.dragged = true;
            navigator.vibrate?.(12);
            onDragStart({ card: obj.id, x: clientX, y: clientY, pointerId: id });
          }, LONG_PRESS_MS);
        }
      }}
      onPointerMove={(event) => {
        const p = press.current;
        if (!p || p.dragged || event.pointerId !== p.id) return;
        const dx = event.clientX - p.x;
        const dy = event.clientY - p.y;
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        // Au doigt, un geste de côté fait défiler la main ; vers le haut, il prend la carte.
        if (event.pointerType === "touch" && !(dy < 0 && Math.abs(dy) > Math.abs(dx))) {
          if (p.timer !== null) window.clearTimeout(p.timer);
          press.current = null;
          return;
        }
        start(event);
      }}
      onPointerUp={() => {
        const p = press.current;
        if (p?.timer) window.clearTimeout(p.timer);
        if (!p?.dragged) press.current = null;
      }}
      onPointerCancel={() => {
        const p = press.current;
        if (p?.timer) window.clearTimeout(p.timer);
        if (!p?.dragged) press.current = null;
      }}
      onClickCapture={(event) => {
        // Après un glisser, le toucher qui suit ne doit pas ouvrir l'aperçu.
        if (press.current?.dragged) {
          event.stopPropagation();
          event.preventDefault();
        }
        press.current = null;
      }}
      onContextMenu={(event) => {
        // L'appui long d'un téléphone ouvre sinon le menu de l'image.
        if (playable) event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

/** La carte qui suit le doigt pendant un glisser. */
export function DragGhost({
  card,
  x,
  y,
  over,
  cost,
}: {
  card: TableCard | undefined;
  x: number;
  y: number;
  /** Au-dessus d'un emplacement permis : la carte rapetisse pour se poser. */
  over: boolean;
  cost?: EngineCost;
}) {
  return (
    <div aria-hidden className="pt-ghost" style={{ left: x, top: y, width: over ? 72 : 104 }}>
      {card?.image ? (
        <img src={card.image} alt="" draggable={false} />
      ) : (
        <div className="pt-ghost__name">{card?.name}</div>
      )}
      {cost && (
        <div className="pt-ghost__cost">
          <CostChips cost={cost} domains={card?.domains ?? []} />
        </div>
      )}
    </div>
  );
}

/** Le coût en pastilles : l'Énergie en rond, chaque Puissance en losange de sa couleur. */
export function CostChips({ cost, domains }: { cost: EngineCost; domains: string[] }) {
  const colorOf = (power: EngineCost["power"][number]) => {
    if (power === "Any") return "conic-gradient(#ef4444, #eab308, #22c55e, #0ea5e9, #a855f7, #ef4444)";
    const domain = power === "Card" ? domains[0]?.toLowerCase() : power.Of.toLowerCase();
    return (domain && DOMAIN_HEX[domain]) || "#94a3b8";
  };
  return (
    <span className="pt-cost">
      <span className="pt-cost__energy">{cost.energy}</span>
      {cost.power.map((power, index) => (
        <span key={index} className="pt-cost__power" style={{ background: colorOf(power) }} />
      ))}
    </span>
  );
}

/** Les marques d'une rune pendant un paiement : É épuisée, R recyclée. */
export const RUNE_MARK: Record<Exclude<RuneUse, "none">, string> = {
  exhaust: "É",
  both: "É+R",
  recycle: "R",
};
