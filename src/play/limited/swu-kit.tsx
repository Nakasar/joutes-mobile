import { useEffect, useMemo, useRef, useState } from "react";

import type { CardFace, Faces } from "../../engine/limited-faces";
import { ASPECT_HEX, isLandscape, type SwuTableCard, type SwuTableCards } from "../../engine/swu/cards";
import {
  emptySwuDeck,
  fitSwuToPool,
  isSwuMain,
  SWU_ASPECTS,
  SWU_RARITIES,
  SWU_RARITY_COLORS,
  swuCostCurve,
  swuDeckAspects,
} from "../../engine/swu/limited";
import { swuLimited } from "../../engine/swu/limited-profile";
import type { SwuConfig, SwuDeckList, SwuRecord } from "../../engine/swu/types";
import { SwuTable } from "../swu/SwuTable";
import { useSwuOnlineGame } from "../swu/useSwuOnlineGame";
import { useSwuSoloGame, type SwuSave } from "../swu/useSwuSoloGame";
import { useSwuTableCards } from "../swu/useSwuTableCards";
import { usePlayT } from "../t";
import type { LimitedKit, OnlineMatchProps, SoloMatchProps } from "./kit";
import { SwuBuildScreen } from "./SwuBuildScreen";
import { CostCurve, Dot } from "./widgets";

const SHOWN_KINDS = ["leader", "base", "unit", "event", "upgrade"] as const;

/** Les cartes de Star Wars: Unlimited dans la forme que lisent les écrans de limité. */
function useSwuFaces(cards: SwuTableCards): Faces {
  const t = usePlayT("Limited");
  return useMemo(() => {
    const groups = SWU_ASPECTS.map((aspect) => ({
      key: aspect,
      label: t(`swu.aspect.${aspect}`),
      color: ASPECT_HEX[aspect],
    }));
    const kindOf = (card: SwuTableCard): string =>
      (SHOWN_KINDS as readonly string[]).includes(card.kind) ? t(`swu.kind.${card.kind}`) : "";
    const aspectsOf = (card: SwuTableCard) => SWU_ASPECTS.filter((aspect) => card.aspects.includes(aspect));
    // « Unité · Commandement, Héroïsme · coût 3 · 3/4 · Rare »
    const line = (card: SwuTableCard): string => {
      const parts: string[] = [kindOf(card)];
      const aspects = aspectsOf(card).map((aspect) => t(`swu.aspect.${aspect}`));
      if (aspects.length > 0) parts.push(aspects.join(", "));
      if (isSwuMain(card)) parts.push(t("swu.cost", { cost: card.cost }));
      if (card.kind === "unit" || card.kind === "leader") parts.push(`${card.power}/${card.hp}`);
      if (card.kind === "base") parts.push(t("swu.hp", { hp: card.hp }));
      if (card.rarity) parts.push(t(`swu.rarity.${card.rarity}`));
      return parts.filter(Boolean).join(" · ");
    };
    const made = new Map<string, CardFace>();
    const get = (code: string): CardFace | undefined => {
      const known = made.get(code);
      if (known) return known;
      const card = cards[code];
      if (!card) return undefined;
      const face: CardFace = {
        name: card.name,
        image: card.image,
        landscape: isLandscape(card.kind),
        text: card.text,
        cost: isSwuMain(card) ? card.cost : null,
        groups: aspectsOf(card),
        kind: kindOf(card),
        line: line(card),
        rarity: Math.max(0, SWU_RARITIES.indexOf(card.rarity ?? "common")),
        ring: (card.rarity && SWU_RARITY_COLORS[card.rarity]) ?? null,
        main: isSwuMain(card),
      };
      made.set(code, face);
      return face;
    };
    return { get, name: (code: string) => cards[code]?.name ?? code, groups, groupWord: t("swu.aspectWord") };
  }, [cards, t]);
}

function useCards(): { cards: SwuTableCards; faces: Faces } {
  const cards = useSwuTableCards();
  const faces = useSwuFaces(cards);
  return { cards, faces };
}

function DeckSummary({ deck, cards, faces }: { deck: SwuDeckList; cards: SwuTableCards; faces: Faces }) {
  const t = usePlayT("Limited");
  const aspects = [...new Set(swuDeckAspects(deck, cards))];
  return (
    <>
      <div className="lim-row lim-row--between">
        <h2 className="lim-title">{t("results.deck", { count: deck.cards.length })}</h2>
        <span className="lim-row">
          {SWU_ASPECTS.filter((aspect) => aspects.includes(aspect)).map((aspect) => (
            <Dot key={aspect} color={ASPECT_HEX[aspect]} />
          ))}
        </span>
      </div>
      <p className="muted lim-small">
        {faces.name(deck.leader)} · {faces.name(deck.base)}
      </p>
      <CostCurve curve={swuCostCurve(deck, cards)} />
      <ul className="lim-list">
        {[...new Set(deck.cards)]
          .sort((a, b) => (cards[a]?.cost ?? 0) - (cards[b]?.cost ?? 0))
          .map((code) => (
            <li key={code} className="lim-line">
              <span className="lim-line__count">×{deck.cards.filter((other) => other === code).length}</span>
              <span className="lim-line__name">{faces.name(code)}</span>
              <span className="lim-line__cost">{cards[code]?.cost ?? ""}</span>
            </li>
          ))}
      </ul>
    </>
  );
}

/** Mon match contre une IA, sur la table de Star Wars: Unlimited. */
function SoloMatch({ save, place, cards, note, home, onRecord, onResult, afterResult }: SoloMatchProps<SwuTableCards, SwuRecord>) {
  // La partie est ouverte une fois : la sauvegarde change à chaque coup, la table reste.
  const [solo] = useState<SwuSave>(() => ({ seat: place, bots: save.bots, record: save.record }));
  const feed = useSwuSoloGame(solo, cards, { onSave: (next) => onRecord(next.record) });
  const result = feed.update?.view.result ?? null;
  const told = useRef(false);
  useEffect(() => {
    if (!result || told.current) return;
    told.current = true;
    onResult(Array.isArray(result.winners) ? (result.winners as number[]) : []);
  }, [result, onResult]);
  return <SwuTable feed={feed} cards={cards} home={home} note={note} afterResult={afterResult} />;
}

/** Mon match, sur la table que le serveur a ouverte pour lui. */
function OnlineMatch({ table, server, cards, note, home, afterResult }: OnlineMatchProps<SwuTableCards>) {
  const feed = useSwuOnlineGame(
    `${server}/games/${encodeURIComponent(table.game)}/ws?ticket=${encodeURIComponent(table.ticket)}`,
    cards,
  );
  return <SwuTable feed={feed} cards={cards} home={home} note={note} afterResult={afterResult} />;
}

/** Le scellé et le draft de Star Wars: Unlimited : ses cartes, sa construction, sa table. */
export const swuLimitedKit: LimitedKit<SwuDeckList, SwuTableCards, SwuRecord, SwuConfig> = {
  ...swuLimited,
  useCards,
  emptyDeck: emptySwuDeck,
  fitToPool: fitSwuToPool,
  soloRecord: (game) => ({ config: game.config, seed: game.seed, actions: [] }),
  worker: () => new Worker(new URL("./swu-simulation.worker.ts", import.meta.url), { type: "module" }),
  Build: SwuBuildScreen,
  DeckSummary,
  SoloMatch,
  OnlineMatch,
};
