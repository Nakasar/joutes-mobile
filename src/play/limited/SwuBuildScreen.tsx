import { useMemo, useState } from "react";

import { stacks, type Pulled } from "../../engine/limited";
import { ASPECT_HEX, type SwuTableCard, type SwuTableCards } from "../../engine/swu/cards";
import {
  addToSwuDeck,
  isSwuMain,
  leftInSwuPool,
  removeFromSwuDeck,
  SWU_ASPECTS,
  swuAspectPenalty,
  swuBaseChoices,
  swuCostCurve,
  swuDeckAspects,
  swuLimitedRules,
} from "../../engine/swu/limited";
import type { SwuAspect, SwuDeckList } from "../../engine/swu/types";
import { usePlayT } from "../t";
import type { BuildProps } from "./kit";
import { CardZoom, CostCurve, DeckProblems, DeckRow, Dot, LimitedCard, SeatStrip, Slot } from "./widgets";

type KindFilter = "all" | "unit" | "event" | "upgrade" | "leader";
const KIND_FILTERS: KindFilter[] = ["all", "unit", "event", "upgrade", "leader"];

function matchesKind(card: SwuTableCard | undefined, filter: KindFilter): boolean {
  if (filter === "all" || !card) return true;
  return card.kind === filter;
}

/**
 * La construction d'un deck de Star Wars: Unlimited avec la réserve : un leader
 * de la réserve, une base (ouverte, ou une base commune de l'extension), et
 * trente cartes au moins (règles 10.2.2 et 10.3.4). Toucher une carte de la
 * réserve l'ajoute, toucher une ligne du deck la retire. Le moteur dit ce qui
 * manque (`problems`) ; rien n'est jugé ici.
 */
export function SwuBuildScreen({ view, seat, cards, faces, deck, problems, onDeck }: BuildProps<SwuDeckList, SwuTableCards>) {
  const t = usePlayT("Limited");
  const [aspects, setAspects] = useState<SwuAspect[]>([]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [zoom, setZoom] = useState<Pulled | null>(null);
  const [tab, setTab] = useState<"pool" | "deck">("pool");

  const pool = useMemo(() => view.you?.pool ?? [], [view.you?.pool]);
  const rules = swuLimitedRules(view.kind);
  const identity = swuDeckAspects(deck, cards);
  const commit = (next: SwuDeckList) => onDeck(next, false);

  const bases = useMemo(() => swuBaseChoices(cards, pool), [cards, pool]);
  const opened = bases.filter((code) => pool.some((card) => card.code === code));
  const common = bases.filter((code) => !opened.includes(code));

  const left = useMemo(() => {
    const order = (card: Pulled) => {
      const found = cards[card.code];
      const aspect = SWU_ASPECTS.findIndex((value) => found?.aspects.includes(value));
      const rank = found?.kind === "leader" ? 0 : isSwuMain(found) ? 1 : 2;
      return [rank, aspect < 0 ? SWU_ASPECTS.length : aspect, found?.cost ?? 0] as const;
    };
    return stacks(
      leftInSwuPool(pool, deck)
        // Les bases se choisissent dans la liste du deck : une base commune n'est pas dans la réserve.
        .filter((card) => cards[card.code]?.kind !== "base")
        .map((card, index) => ({ card, index, key: order(card) }))
        .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index)
        .map(({ card }) => card),
    );
  }, [pool, deck, cards]);
  const shown = left.filter((stack) => {
    const card = cards[stack.code];
    return matchesKind(card, kind) && (aspects.length === 0 || aspects.some((aspect) => card?.aspects.includes(aspect)));
  });
  const leftCount = left.reduce((sum, stack) => sum + stack.count, 0);

  const mainStacks = stacks(
    [...deck.cards]
      .sort((a, b) => (cards[a]?.cost ?? 0) - (cards[b]?.cost ?? 0) || faces.name(a).localeCompare(faces.name(b)))
      .map((code) => ({ code })),
  );
  const penalized = deck.cards.filter((code) => swuAspectPenalty(cards[code], identity) > 0).length;
  const baseLabel = (code: string) => {
    const card = cards[code];
    const names = SWU_ASPECTS.filter((aspect) => card?.aspects.includes(aspect)).map((aspect) => t(`swu.aspect.${aspect}`));
    return [faces.name(code), ...names, card ? t("swu.hp", { hp: card.hp }) : ""].filter(Boolean).join(" · ");
  };

  return (
    <>
      <SeatStrip view={view} seat={seat} />
      <div className="lim-tabs">
        <div className="lim-seg" role="group" aria-label={t("build.tabs")}>
          <button type="button" aria-pressed={tab === "pool"} onClick={() => setTab("pool")}>
            {t("build.pool", { count: leftCount })}
          </button>
          <button type="button" aria-pressed={tab === "deck"} onClick={() => setTab("deck")}>
            {t("build.tabDeck", { count: deck.cards.length })}
          </button>
        </div>
      </div>
      <div className="lim-build" data-tab={tab}>
        <section className="lim-panel lim-build__pool">
          <h2 className="lim-title">{t("build.pool", { count: leftCount })}</h2>
          <div className="lim-seg" role="group" aria-label={t("build.kindFilter")}>
            {KIND_FILTERS.map((value) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
                {t(`swu.build.kind.${value}`)}
              </button>
            ))}
          </div>
          <div className="lim-pills" role="group" aria-label={t("swu.build.aspectFilter")}>
            {SWU_ASPECTS.map((aspect) => {
              const on = aspects.includes(aspect);
              return (
                <button
                  key={aspect}
                  type="button"
                  className="lim-pill"
                  aria-pressed={on}
                  onClick={() => setAspects(on ? aspects.filter((value) => value !== aspect) : [...aspects, aspect])}
                >
                  <Dot color={ASPECT_HEX[aspect]} />
                  {t(`swu.aspect.${aspect}`)}
                </button>
              );
            })}
          </div>
          {shown.length === 0 ? (
            <p className="lim-empty">{t("build.poolEmpty")}</p>
          ) : (
            <div className="lim-grid">
              {shown.map((stack) => {
                const card = cards[stack.code];
                const name = faces.name(stack.code);
                const penalty = isSwuMain(card) && deck.leader && deck.base ? swuAspectPenalty(card, identity) : 0;
                return (
                  <LimitedCard
                    key={`${stack.code}${stack.foil ? "f" : ""}`}
                    code={stack.code}
                    foil={stack.foil}
                    count={stack.count}
                    faces={faces}
                    dim={penalty > 0}
                    note={penalty > 0 ? t("swu.build.penalty", { count: penalty }) : undefined}
                    label={card?.kind === "leader" ? t("swu.build.chooseLeader", { name }) : t("build.add", { name })}
                    onClick={card ? () => commit(addToSwuDeck(deck, card)) : undefined}
                    onInspect={() => setZoom({ code: stack.code, foil: stack.foil })}
                  />
                );
              })}
            </div>
          )}
          <p className="muted lim-small">{t("swu.build.hint")}</p>
        </section>

        <aside className="lim-build__side">
          <section className="lim-panel">
            <div className="lim-row lim-row--between">
              <h2 className="lim-title">{t("build.deck")}</h2>
              <span className="lim-row">
                {SWU_ASPECTS.filter((aspect) => identity.includes(aspect)).map((aspect) => (
                  <Dot key={aspect} color={ASPECT_HEX[aspect]} />
                ))}
              </span>
            </div>

            <div className="lim-col">
              <span className="lim-label">{t("swu.kind.leader")}</span>
              <Slot
                name={deck.leader ? faces.name(deck.leader) : t("swu.build.noLeader")}
                empty={!deck.leader}
                onInspect={deck.leader ? () => setZoom({ code: deck.leader }) : undefined}
                onRemove={deck.leader ? () => commit({ ...deck, leader: "" }) : undefined}
                removeLabel={deck.leader ? t("build.remove", { name: faces.name(deck.leader) }) : ""}
              />
            </div>

            <label className="lim-col">
              <span className="lim-label">{t("swu.kind.base")}</span>
              <select value={deck.base} onChange={(event) => commit({ ...deck, base: event.target.value })}>
                <option value="">{t("swu.build.noBase")}</option>
                {opened.length > 0 && (
                  <optgroup label={t("swu.build.basesOpened")}>
                    {opened.map((code) => (
                      <option key={code} value={code}>
                        {baseLabel(code)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {common.length > 0 && (
                  <optgroup label={t("swu.build.basesCommon")}>
                    {common.map((code) => (
                      <option key={code} value={code}>
                        {baseLabel(code)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span className="muted lim-small">{t("swu.build.baseHint")}</span>
            </label>

            <div className="lim-col">
              <span className="lim-row lim-row--between">
                <span className="lim-label">{t("swu.build.main")}</span>
                <span className={`lim-small${deck.cards.length >= rules.minMain ? " lim-ok" : ""}`}>
                  {t("build.mainCount", { count: deck.cards.length, min: rules.minMain })}
                </span>
              </span>
              {deck.cards.length === 0 ? (
                <p className="muted lim-small">{t("build.mainEmpty")}</p>
              ) : (
                <ul className="lim-list">
                  {mainStacks.map((stack) => {
                    const card = cards[stack.code];
                    const penalty = swuAspectPenalty(card, identity);
                    return (
                      <DeckRow
                        key={stack.code}
                        code={stack.code}
                        count={stack.count}
                        faces={faces}
                        name={faces.name(stack.code)}
                        cost={
                          penalty > 0 && card ? (
                            <span className="lim-warn" title={t("swu.build.penaltyTitle", { count: penalty })}>
                              {card.cost}+{penalty}
                            </span>
                          ) : undefined
                        }
                        removeLabel={t("build.remove", { name: faces.name(stack.code) })}
                        onRemove={() => commit(removeFromSwuDeck(deck, stack.code))}
                        onInspect={() => setZoom({ code: stack.code })}
                      />
                    );
                  })}
                </ul>
              )}
              <CostCurve curve={swuCostCurve(deck, cards)} />
              {penalized > 0 && <p className="lim-warn lim-small">{t("swu.build.penalized", { count: penalized })}</p>}
            </div>
          </section>

          <DeckProblems problems={problems} />
        </aside>
      </div>
      <CardZoom code={zoom?.code ?? null} foil={zoom?.foil} faces={faces} onClose={() => setZoom(null)} />
    </>
  );
}
