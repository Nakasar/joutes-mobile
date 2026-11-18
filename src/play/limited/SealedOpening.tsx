import { useState } from "react";

import type { LimitedView, Pulled } from "../../engine/limited";
import { groupCounts, mainOnly, sortPack, type Faces } from "../../engine/limited-faces";
import { CheckIcon } from "../icons";
import { usePlayT } from "../t";
import { ActionBar, CardZoom, GroupCounts, LimitedCard, SeatStrip } from "./widgets";

/**
 * L'ouverture d'un scellé : les boosters se regardent un par un. Le moteur les
 * a tous ouverts à la création ; `opened` dit seulement combien on en a vu.
 */
export function SealedOpening({
  view,
  seat,
  faces,
  opened,
  onOpened,
}: {
  view: LimitedView<unknown>;
  seat: number;
  faces: Faces;
  opened: number;
  onOpened: (opened: number) => void;
}) {
  const t = usePlayT("Limited");
  const [zoom, setZoom] = useState<Pulled | null>(null);
  const pool = view.you?.pool ?? [];
  const boosters = view.packs.length;
  const size = boosters > 0 ? Math.floor(pool.length / boosters) : 0;
  const current = Math.min(opened, boosters - 1);
  const pack = pool.slice(current * size, (current + 1) * size);
  const seen = pool.slice(0, (current + 1) * size);
  const last = current >= boosters - 1;
  const rares = seen.filter((card) => faces.get(card.code)?.ring).length;

  return (
    <>
      <SeatStrip view={view} seat={seat} />
      <section className="lim-panel">
        <ol className="lim-pills" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {view.packs.map((set, index) => (
            <li
              key={index}
              aria-current={index === current ? "step" : undefined}
              aria-label={t("sealed.booster", { number: index + 1, set })}
              className={`lim-pill${index === current ? " lim-pill--on" : ""}`}
            >
              {index < current && <CheckIcon size={13} className="lim-ok" />}
              {index + 1}
            </li>
          ))}
        </ol>
        <h2 className="lim-title">{t("sealed.title", { number: current + 1, boosters, set: view.packs[current] ?? "" })}</h2>
        <div className="lim-grid">
          {sortPack(pack, faces, "rarity").map((card, index) => (
            <LimitedCard
              key={`${current}-${index}`}
              code={card.code}
              foil={card.foil}
              faces={faces}
              showRarity
              label={t("inspect", { name: faces.name(card.code) })}
              onClick={() => setZoom(card)}
            />
          ))}
        </div>
      </section>
      <section className="lim-panel">
        <h2 className="lim-title">{t("sealed.poolTitle", { count: seen.length, total: pool.length })}</h2>
        <GroupCounts
          counts={groupCounts(
            mainOnly(
              seen.map((card) => card.code),
              faces,
            ),
            faces,
          )}
          faces={faces}
        />
        <p className="muted lim-small">{t("sealed.rares", { count: rares })}</p>
      </section>
      <ActionBar>
        {!last && (
          <button type="button" className="btn btn--outline" onClick={() => onOpened(boosters)}>
            {t("sealed.skip")}
          </button>
        )}
        <button type="button" className="btn btn--grad" onClick={() => onOpened(last ? boosters : current + 1)}>
          {t(last ? "sealed.build" : "sealed.next")}
        </button>
      </ActionBar>
      <CardZoom code={zoom?.code ?? null} foil={zoom?.foil} faces={faces} onClose={() => setZoom(null)} />
    </>
  );
}
