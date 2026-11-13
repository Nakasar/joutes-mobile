import type { CSSProperties } from "react";

import type { TableCard, TableCards } from "../engine/cards";
import { DOMAIN_HEX, splitTold, type ToldIndex } from "../engine/told-text";

type ToldTextProps = {
  text: string;
  index: ToldIndex;
  cards: TableCards;
  colorOf: (seat: number) => string;
  onInspect: (card: TableCard) => void;
};

/** Le nom d'une carte aux couleurs de ses domaines : une couleur, ou un dégradé. */
function cardStyle(card: TableCard | undefined): CSSProperties | undefined {
  const colors = (card?.domains ?? []).map((domain) => DOMAIN_HEX[domain.toLowerCase()]).filter(Boolean);
  if (colors.length === 0) return undefined;
  if (colors.length === 1) return { color: colors[0] };
  return {
    backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };
}

/**
 * Une ligne du récit avec ses noms mis en évidence, comme sur le site : les
 * joueurs à leur couleur, les cartes aux couleurs de leurs domaines. Toucher
 * une carte l'ouvre en grand (le survol n'existe pas au doigt).
 */
export function ToldText({ text, index, cards, colorOf, onInspect }: ToldTextProps) {
  return (
    <>
      {splitTold(text, index).map((segment, at) => {
        if (segment.kind === "text") return <span key={at}>{segment.text}</span>;
        if (segment.kind === "player") {
          return (
            <strong key={at} style={{ color: colorOf(segment.seat) }}>
              {segment.text}
            </strong>
          );
        }
        const card = cards[segment.code];
        if (!card) return <strong key={at}>{segment.text}</strong>;
        return (
          <button
            key={at}
            type="button"
            className="pt-told-card"
            style={cardStyle(card)}
            onClick={(event) => {
              event.stopPropagation();
              onInspect(card);
            }}
          >
            {segment.text}
          </button>
        );
      })}
    </>
  );
}
