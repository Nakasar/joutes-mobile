import { useMemo, useState } from "react";

import type { TableCard, TableCards } from "../../engine/cards";
import {
  addToDeck,
  BLANK_BATTLEFIELD,
  chooseChampion,
  chosenDomains,
  clearBattlefield,
  costCurve,
  DOMAINS,
  fitsDomains,
  leftInPool,
  limitedRules,
  mainCodes,
  removeFromMain,
  RUNE_COUNT,
  runeCounts,
  runesFrom,
  splitRunes,
  stacks,
  type Domain,
  type Pulled,
} from "../../engine/limited";
import type { EngineDeckList } from "../../engine/types";
import { MinusIcon, PlusIcon } from "../icons";
import { usePlayT } from "../t";
import type { BuildProps } from "./kit";
import { CardZoom, CostCurve, DeckProblems, DeckRow, DomainDot, isMainCard, LimitedCard, SeatStrip, Slot } from "./widgets";

type KindFilter = "all" | "unit" | "spell" | "gear" | "other";
const KIND_FILTERS: KindFilter[] = ["all", "unit", "spell", "gear", "other"];

function matchesKind(card: TableCard | undefined, filter: KindFilter): boolean {
  if (filter === "all" || !card) return true;
  if (filter === "other") return card.kind === "legend" || card.kind === "battlefield";
  return card.kind === filter;
}

/**
 * La construction du deck avec la réserve : toucher une carte de la réserve
 * l'ajoute, toucher une ligne du deck la retire. Sur un téléphone, la réserve
 * et le deck sont deux onglets. Le moteur dit ce qui manque (`problems`) ; rien
 * n'est jugé ici.
 */
export function BuildScreen({
  view,
  seat,
  cards,
  faces,
  deck,
  // Vrai : les runes ont été réparties à la main, on n'y touche plus.
  byHand: runesByHand,
  problems,
  onDeck,
}: BuildProps<EngineDeckList, TableCards>) {
  const cardName = (code: string) => faces.name(code);
  const t = usePlayT("Limited");
  const tPlay = usePlayT("Play");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [zoom, setZoom] = useState<Pulled | null>(null);
  const [tab, setTab] = useState<"pool" | "deck">("pool");

  const pool = useMemo(() => view.you?.pool ?? [], [view.you?.pool]);
  const rules = limitedRules(view.kind);
  const identity = chosenDomains(deck, cards);
  const main = mainCodes(deck);
  const counts = runeCounts(deck, cards);
  const runeDomains = DOMAINS.filter((domain) => identity.includes(domain) || counts[domain] > 0);

  /** Garde le deck ; les runes suivent tant qu'on ne les a pas réparties soi-même. */
  const commit = (next: EngineDeckList, byHand = runesByHand) =>
    onDeck(byHand ? next : { ...next, runes: runesFrom(splitRunes(next, cards), cards) }, byHand);

  const left = useMemo(() => {
    const order = (card: Pulled) => {
      const found = cards[card.code];
      const domain = DOMAINS.findIndex((value) => found?.domains.includes(value));
      return [isMainCard(found) ? 0 : 1, domain < 0 ? DOMAINS.length : domain, found?.energy ?? 0] as const;
    };
    return stacks(
      leftInPool(pool, deck)
        .filter((card) => cards[card.code]?.kind !== "rune")
        .map((card, index) => ({ card, index, key: order(card) }))
        .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index)
        .map(({ card }) => card),
    );
  }, [pool, deck, cards]);
  const shown = left.filter((stack) => {
    const card = cards[stack.code];
    return matchesKind(card, kind) && (domains.length === 0 || domains.some((domain) => card?.domains.includes(domain)));
  });
  const leftCount = left.reduce((sum, stack) => sum + stack.count, 0);

  const champions = [...new Set(main)].filter((code) => cards[code]?.champion);
  const mainStacks = stacks(
    [...deck.main]
      .sort((a, b) => (cards[a]?.energy ?? 0) - (cards[b]?.energy ?? 0) || cardName(a).localeCompare(cardName(b)))
      .map((code) => ({ code })),
  );

  const setRunes = (domain: Domain, delta: number) => {
    const next = { ...counts, [domain]: Math.max(0, counts[domain] + delta) };
    onDeck({ ...deck, runes: runesFrom(next, cards) }, true);
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
            {t("build.tabDeck", { count: main.length })}
          </button>
        </div>
      </div>
      <div className="lim-build" data-tab={tab}>
        <section className="lim-panel lim-build__pool">
          <h2 className="lim-title">{t("build.pool", { count: leftCount })}</h2>
          <div className="lim-seg" role="group" aria-label={t("build.kindFilter")}>
            {KIND_FILTERS.map((value) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
                {t(`build.kind.${value}`)}
              </button>
            ))}
          </div>
          <div className="lim-pills" role="group" aria-label={t("build.domainFilter")}>
            {DOMAINS.map((domain) => {
              const on = domains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  className="lim-pill"
                  aria-pressed={on}
                  onClick={() => setDomains(on ? domains.filter((value) => value !== domain) : [...domains, domain])}
                >
                  <DomainDot domain={domain} />
                  {tPlay(`domain.${domain}`)}
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
                const name = cardName(stack.code);
                return (
                  <LimitedCard
                    key={`${stack.code}${stack.foil ? "f" : ""}`}
                    code={stack.code}
                    foil={stack.foil}
                    count={stack.count}
                    faces={faces}
                    dim={isMainCard(card) && !fitsDomains(card, identity)}
                    label={t("build.add", { name })}
                    onClick={card ? () => commit(addToDeck(deck, card)) : undefined}
                    onInspect={() => setZoom({ code: stack.code, foil: stack.foil })}
                  />
                );
              })}
            </div>
          )}
          <p className="muted lim-small">{t("build.hint")}</p>
        </section>

        <aside className="lim-build__side">
          <section className="lim-panel">
            <div className="lim-row lim-row--between">
              <h2 className="lim-title">{t("build.deck")}</h2>
              <span className="lim-row muted lim-small">
                {identity.map((domain) => (
                  <DomainDot key={domain} domain={domain} />
                ))}
                {t("build.identity", { count: identity.length })}
              </span>
            </div>

            <div className="lim-col">
              <span className="lim-label">{tPlay("kind.legend")}</span>
              <Slot
                name={deck.legend ? cardName(deck.legend) : t("noLegend")}
                empty={!deck.legend}
                onInspect={deck.legend ? () => setZoom({ code: deck.legend }) : undefined}
                onRemove={deck.legend ? () => commit({ ...deck, legend: "" }) : undefined}
                removeLabel={deck.legend ? t("build.remove", { name: cardName(deck.legend) }) : ""}
              />
            </div>

            <label className="lim-col">
              <span className="lim-label">{t("build.champion")}</span>
              <select value={deck.champion} onChange={(event) => commit(chooseChampion(deck, event.target.value))}>
                <option value="">{t("build.noChampion")}</option>
                {champions.map((code) => (
                  <option key={code} value={code}>
                    {cardName(code)}
                  </option>
                ))}
              </select>
              {champions.length === 0 && <span className="muted lim-small">{t("build.championHint")}</span>}
            </label>

            <div className="lim-col">
              <span className="lim-row lim-row--between">
                <span className="lim-label">{t("build.main")}</span>
                <span className={`lim-small${main.length >= rules.minMain ? " lim-ok" : ""}`}>
                  {t("build.mainCount", { count: main.length, min: rules.minMain })}
                </span>
              </span>
              {main.length === 0 ? (
                <p className="muted lim-small">{t("build.mainEmpty")}</p>
              ) : (
                <ul className="lim-list">
                  {deck.champion && (
                    <DeckRow
                      code={deck.champion}
                      count={1}
                      faces={faces}
                      name={cardName(deck.champion)}
                      badge={t("build.chosen")}
                      removeLabel={t("build.remove", { name: cardName(deck.champion) })}
                      onRemove={() => commit({ ...deck, champion: "" })}
                      onInspect={() => setZoom({ code: deck.champion })}
                    />
                  )}
                  {mainStacks.map((stack) => (
                    <DeckRow
                      key={stack.code}
                      code={stack.code}
                      count={stack.count}
                      faces={faces}
                      name={cardName(stack.code)}
                      removeLabel={t("build.remove", { name: cardName(stack.code) })}
                      onRemove={() => commit(removeFromMain(deck, stack.code))}
                      onInspect={() => setZoom({ code: stack.code })}
                    />
                  ))}
                </ul>
              )}
              <CostCurve curve={costCurve(main, cards)} />
            </div>
          </section>

          <section className="lim-panel">
            <div className="lim-row lim-row--between">
              <h2 className="lim-title">{t("build.runes", { count: deck.runes.length, total: RUNE_COUNT })}</h2>
              {runesByHand && (
                <button type="button" className="btn btn--outline" onClick={() => commit(deck, false)}>
                  {t("build.runesAuto")}
                </button>
              )}
            </div>
            {runeDomains.length === 0 ? (
              <p className="muted lim-small">{t("build.runesEmpty")}</p>
            ) : (
              <ul className="lim-col" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {runeDomains.map((domain) => (
                  <li key={domain} className="lim-row">
                    <DomainDot domain={domain} />
                    <span className="lim-grow">{tPlay(`domain.${domain}`)}</span>
                    <button
                      type="button"
                      className="lim-icon lim-icon--line"
                      disabled={counts[domain] === 0}
                      aria-label={t("build.runeLess", { domain: tPlay(`domain.${domain}`) })}
                      onClick={() => setRunes(domain, -1)}
                    >
                      <MinusIcon size={15} />
                    </button>
                    <strong style={{ width: "1.6rem", textAlign: "center" }}>{counts[domain]}</strong>
                    <button
                      type="button"
                      className="lim-icon lim-icon--line"
                      disabled={deck.runes.length >= RUNE_COUNT}
                      aria-label={t("build.runeMore", { domain: tPlay(`domain.${domain}`) })}
                      onClick={() => setRunes(domain, 1)}
                    >
                      <PlusIcon size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted lim-small">{t(runesByHand ? "build.runesByHand" : "build.runesFollow")}</p>
          </section>

          <section className="lim-panel">
            <h2 className="lim-title">{t("build.battlefields")}</h2>
            <ul className="lim-col" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {deck.battlefields.map((code, index) => {
                const blank = code === BLANK_BATTLEFIELD;
                const name = cardName(code);
                return (
                  <li key={index}>
                    <Slot
                      name={name}
                      empty={blank}
                      onInspect={blank ? undefined : () => setZoom({ code })}
                      onRemove={blank ? undefined : () => commit(clearBattlefield(deck, index))}
                      removeLabel={t("build.remove", { name })}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="muted lim-small">{t("build.battlefieldsHint")}</p>
          </section>

          <DeckProblems problems={problems} />
        </aside>
      </div>
      <CardZoom code={zoom?.code ?? null} foil={zoom?.foil} faces={faces} onClose={() => setZoom(null)} />
    </>
  );
}
