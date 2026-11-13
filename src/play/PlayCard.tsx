import { useState } from "react";

import type { TableCard } from "../engine/cards";
import type { EngineAction, EngineChoice, EngineObj } from "../engine/types";
import { usePlayT } from "./t";
import { Sheet } from "./ui";

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

export type PlayCardProps = {
  obj?: EngineObj;
  card?: TableCard;
  size?: CardSize;
  /** Les actions que le moteur permet sur cette carte, maintenant. */
  choices?: EngineChoice[];
  onAct?: (action: EngineAction) => void;
  onInspect?: () => void;
  /** Mulligan : la carte est cochée. */
  selected?: boolean;
  /** Atténuée : une autre carte ou un autre choix est attendu. */
  dim?: boolean;
  /** Concernée par l'évènement que la table raconte : entourée d'ambre. */
  focus?: boolean;
  /** Dégâts reçus dans l'évènement raconté : la carte tremble et les affiche. */
  hit?: number;
  /** Une unité qui vient de mourir, encore dessinée le temps de le raconter. */
  dying?: boolean;
  className?: string;
};

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Une carte sur la table, comme sur le site (`components/play/PlayCard.tsx`) :
 * cerclée de cyan quand le moteur permet d'agir dessus. Un toucher joue
 * l'action, ou ouvre la liste s'il y en a plusieurs ; sans action, il montre la
 * carte en grand. La loupe montre la carte même quand elle est jouable.
 */
export function PlayCard({
  obj,
  card,
  size = "md",
  choices = [],
  onAct,
  onInspect,
  selected = false,
  dim = false,
  focus = false,
  hit,
  dying = false,
  className,
}: PlayCardProps) {
  const t = usePlayT("Play");
  const [menu, setMenu] = useState(false);
  const hidden = obj ? obj.code === null : !card;
  const landscape = card?.landscape === true;
  const name = card?.name ?? obj?.name ?? t("card.hidden");
  const actionable = choices.length > 0 && onAct !== undefined;
  const small = size === "xs" || size === "sm";
  const label = actionable ? (choices.length === 1 ? choices[0].label : name) : name;

  const press = () => {
    if (!actionable) return onInspect?.();
    if (choices.length === 1) return onAct?.(choices[0].action);
    setMenu(true);
  };

  return (
    <span className={cx("pt-card-wrap", className)}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={selected || undefined}
        data-obj={obj?.id}
        onClick={press}
        onContextMenu={(event) => {
          if (!onInspect) return;
          event.preventDefault();
          onInspect();
        }}
        className={cx(
          "pt-card play-enter",
          `pt-card--${size}`,
          landscape && "pt-card--land",
          obj?.exhausted && "pt-card--exhausted",
          dim && !actionable && "pt-card--dim",
          actionable && "pt-card--can",
          selected && "pt-card--selected",
          focus && !actionable && !selected && "play-focus",
          hit !== undefined && "play-shake",
          dying && "pt-card--dying",
        )}
      >
        {hidden ? (
          <span aria-hidden className="pt-card__back" />
        ) : card?.image ? (
          <img src={card.image} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="pt-card__name">{name}</span>
        )}

        {obj?.role && !small && (
          <span className="pt-card__role" aria-label={t(obj.role === "Attacker" ? "card.attacker" : "card.defender")}>
            {obj.role === "Attacker" ? "⚔" : "⛨"}
          </span>
        )}
        {obj?.stunned && (
          <span className="pt-card__stun" aria-label={t("card.stunned")}>
            ⚡
          </span>
        )}
        {obj && obj.might !== null && !hidden && obj.zone !== "Hand" && obj.zone !== "Champion" && (
          <span className="pt-card__might">
            {obj.buffs > 0 && <span className="pt-card__buff">+{obj.buffs}</span>}
            {obj.damage > 0 && <span className="pt-card__dmg">−{obj.damage}</span>}
            <span className={cx("pt-card__mv", obj.damage > 0 && "pt-card__mv--hurt")}>{obj.might}</span>
          </span>
        )}
      </button>
      {actionable && onInspect && !small && (
        <button
          type="button"
          className="pt-card__inspect"
          aria-label={t("card.inspect", { name })}
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </button>
      )}
      {hit !== undefined && (
        <span aria-hidden className="pt-card__float play-float">
          −{hit}
        </span>
      )}
      {menu && (
        <Sheet title={name} onClose={() => setMenu(false)}>
          <div className="pt-choice-list">
            {choices.map((choice, index) => (
              <button
                key={index}
                type="button"
                className="btn btn--outline btn--block pt-choice"
                onClick={() => {
                  setMenu(false);
                  onAct?.(choice.action);
                }}
              >
                {choice.label}
              </button>
            ))}
            {onInspect && (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => {
                  setMenu(false);
                  onInspect();
                }}
              >
                {t("card.inspect", { name })}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </span>
  );
}
