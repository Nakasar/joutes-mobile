import { useEffect, useMemo, useRef, useState } from "react";

import type { TableCard, TableCards } from "../../engine/cards";
import {
  BLANK_BATTLEFIELD,
  BLANK_LEGEND,
  chosenDomains,
  costCurve,
  DOMAIN_COLORS,
  DOMAINS,
  emptyDeck,
  fitToPool,
  mainCodes,
  RARITIES,
  RARITY_COLORS,
} from "../../engine/limited";
import type { CardFace, Faces } from "../../engine/limited-faces";
import { riftboundLimited } from "../../engine/limited-riftbound";
import type { EngineConfig, EngineDeckList, EngineRecord } from "../../engine/types";
import { RiftboundTable } from "../RiftboundTable";
import { usePlayT } from "../t";
import { useOnlineGame } from "../useOnlineGame";
import { useSoloGame, type SoloSave } from "../useSoloGame";
import { useTableCards } from "../useTableCards";
import { BuildScreen } from "./BuildScreen";
import type { LimitedKit, OnlineMatchProps, SoloMatchProps } from "./kit";
import { CostCurve, DomainDot, isMainCard } from "./widgets";

/** Les cartes de Riftbound dans la forme que lisent les écrans de limité. */
function useRiftboundFaces(cards: TableCards): Faces {
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  return useMemo(() => {
    const groups = DOMAINS.map((domain) => ({
      key: domain,
      label: tPlay(`domain.${domain}`),
      color: DOMAIN_COLORS[domain],
    }));
    const domainsOf = (card: TableCard) => DOMAINS.filter((domain) => card.domains.includes(domain));
    // « Unité · champion · Ordre · coût 4 · Rare »
    const line = (card: TableCard): string => {
      const parts: string[] = [tPlay(`kind.${card.kind}`)];
      if (card.champion) parts.push(t("champion"));
      const domains = domainsOf(card).map((domain) => tPlay(`domain.${domain}`));
      if (domains.length > 0) parts.push(domains.join(", "));
      if (isMainCard(card)) parts.push(t("cost", { energy: card.energy }));
      if (card.kind === "unit" && card.might !== undefined) parts.push(t("might", { might: card.might }));
      if (card.rarity) parts.push(t(`rarity.${card.rarity}`));
      return parts.join(" · ");
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
        landscape: card.landscape === true,
        text: card.text,
        cost: isMainCard(card) ? card.energy : null,
        groups: domainsOf(card),
        kind: tPlay(`kind.${card.kind}`),
        line: line(card),
        rarity: Math.max(0, RARITIES.indexOf(card.rarity ?? "common")),
        ring: card.rarity === "rare" || card.rarity === "epic" ? RARITY_COLORS[card.rarity] : null,
        main: isMainCard(card),
      };
      made.set(code, face);
      return face;
    };
    const name = (code: string): string =>
      code === BLANK_BATTLEFIELD ? t("blankBattlefield") : code === BLANK_LEGEND ? t("noLegend") : (cards[code]?.name ?? code);
    return { get, name, groups, groupWord: t("draft.sortBy.domain") };
  }, [cards, t, tPlay]);
}

function DeckSummary({ deck, cards, faces }: { deck: EngineDeckList; cards: TableCards; faces: Faces }) {
  const t = usePlayT("Limited");
  const main = mainCodes(deck);
  return (
    <>
      <div className="lim-row lim-row--between">
        <h2 className="lim-title">{t("results.deck", { count: main.length })}</h2>
        <span className="lim-row">
          {chosenDomains(deck, cards).map((domain) => (
            <DomainDot key={domain} domain={domain} />
          ))}
        </span>
      </div>
      <p className="muted lim-small">
        {deck.legend ? faces.name(deck.legend) : t("noLegend")}
        {deck.champion ? ` · ${faces.name(deck.champion)}` : ""}
      </p>
      <CostCurve curve={costCurve(main, cards)} />
      <ul className="lim-list">
        {[...new Set(main)]
          .sort((a, b) => (cards[a]?.energy ?? 0) - (cards[b]?.energy ?? 0))
          .map((code) => (
            <li key={code} className="lim-line">
              <span className="lim-line__count">×{main.filter((other) => other === code).length}</span>
              <span className="lim-line__name">{faces.name(code)}</span>
              <span className="lim-line__cost">{cards[code]?.energy ?? ""}</span>
            </li>
          ))}
      </ul>
    </>
  );
}

/** Mon match contre une IA, sur la table de jeu habituelle. */
function SoloMatch({ save, place, cards, note, home, onRecord, onResult, afterResult }: SoloMatchProps<TableCards, EngineRecord>) {
  // La partie est ouverte une fois : la sauvegarde change à chaque coup, la table reste.
  const [solo] = useState<SoloSave>(() => ({ seat: place, bots: save.bots, record: save.record }));
  const feed = useSoloGame(solo, { onSave: (next) => onRecord(next.record) });
  const result = feed.update?.view.result ?? null;
  const told = useRef(false);
  useEffect(() => {
    if (!result || told.current) return;
    told.current = true;
    onResult(result.winners);
  }, [result, onResult]);
  return <RiftboundTable feed={feed} cards={cards} home={home} note={note} afterResult={afterResult} />;
}

/** Mon match, sur la table que le serveur a ouverte pour lui. */
function OnlineMatch({ table, server, cards, note, home, afterResult }: OnlineMatchProps<TableCards>) {
  const feed = useOnlineGame(`${server}/games/${encodeURIComponent(table.game)}/ws?ticket=${encodeURIComponent(table.ticket)}`);
  return <RiftboundTable feed={feed} cards={cards} home={home} note={note} afterResult={afterResult} />;
}

function useCards(): { cards: TableCards; faces: Faces } {
  const cards = useTableCards();
  const faces = useRiftboundFaces(cards);
  return { cards, faces };
}

/** Le scellé et le draft de Riftbound : ses cartes, sa construction, sa table. */
export const riftboundLimitedKit: LimitedKit<EngineDeckList, TableCards, EngineRecord, EngineConfig> = {
  ...riftboundLimited,
  useCards,
  emptyDeck,
  fitToPool,
  // Le joueur choisit son paiement, comme sur une table ordinaire.
  soloRecord: (game, place) => ({
    config: {
      ...game.config,
      players: game.config.players.map((player, index) => (index === place ? { ...player, manual_pay: true } : player)),
    },
    seed: game.seed,
    actions: [],
  }),
  worker: () => new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" }),
  Build: BuildScreen,
  DeckSummary,
  SoloMatch,
  OnlineMatch,
};
