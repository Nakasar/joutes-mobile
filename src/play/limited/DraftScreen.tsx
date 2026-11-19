import { useState } from "react";

import { stacks, type LimitedView, type Pulled } from "../../engine/limited";
import { faceCurve, groupCounts, mainOnly, PACK_SORTS, sortPack, type Faces, type PackSort } from "../../engine/limited-faces";
import { usePlayT } from "../t";
import { Sheet } from "../ui";
import { ActionBar, CardZoom, CostCurve, GroupCounts, LimitedCard, SeatStrip, useFaceLine } from "./widgets";

/**
 * Le draft : un paquet devant soi, une carte à prendre, le reste passe au
 * voisin. Un toucher regarde une carte (elle s'annonce dans la barre du bas,
 * avec « Prendre cette carte »), la loupe l'ouvre en grand.
 */
export function DraftScreen({
  view,
  seat,
  faces,
  packSize,
  onPick,
  onRefused,
}: {
  view: LimitedView<unknown>;
  seat: number;
  faces: Faces;
  /** Le nombre de cartes d'un booster au début d'un tour de table. */
  packSize: number;
  /** Prend une carte ; rend le refus du moteur, s'il y en a un. */
  onPick: (card: Pulled) => string | null;
  onRefused: (message: string) => void;
}) {
  const t = usePlayT("Limited");
  const line = useFaceLine();
  const [sort, setSort] = useState<PackSort>("rarity");
  // La carte regardée, par sa place dans le paquet du moteur.
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState<Pulled | null>(null);
  const [picks, setPicks] = useState(false);

  const pack = view.you?.pack ?? null;
  const pool = view.you?.pool ?? [];
  // Avant les boosters, un jeu peut faire tourner d'autres paquets : les leaders
  // de Star Wars: Unlimited, un par booster (règle 10.3.3.a).
  const prelude = view.prelude ?? 0;
  const leaders = view.round < prelude;
  const size = leaders ? view.rounds : packSize;
  const booster = view.round - prelude;
  const chosen = pack && selected !== null ? (pack[selected] ?? null) : null;
  const mainPool = mainOnly(
    pool.map((card) => card.code),
    faces,
  );
  const title = leaders
    ? pack
      ? t("draft.titleLeaders", { pick: size - pack.length + 1, size })
      : t("draft.titleLeadersWaiting")
    : pack
      ? t("draft.title", { round: booster + 1, rounds: view.rounds, pick: size - pack.length + 1, size })
      : t("draft.titleWaiting", { round: booster + 1, rounds: view.rounds });
  const passing = leaders
    ? t(view.pass_next ? "draft.leadersNext" : "draft.leadersPrevious")
    : t(view.pass_next ? "draft.passNext" : "draft.passPrevious", { set: view.packs[booster] ?? "" });

  const pick = (card: Pulled) => {
    const refused = onPick(card);
    if (refused) onRefused(refused);
    setSelected(null);
    setZoom(null);
  };

  const take = chosen && (
    <button type="button" className="btn btn--grad" onClick={() => pick(chosen)}>
      {t("draft.take")}
    </button>
  );

  return (
    <>
      <SeatStrip view={view} seat={seat} />
      <section className="lim-panel">
        <div className="lim-col">
          <h2 className="lim-title">{title}</h2>
          <p className="muted lim-small">{passing}</p>
        </div>
        <div className="lim-seg" role="group" aria-label={t("draft.sort")}>
          {PACK_SORTS.map((value) => (
            <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)}>
              {value === "group" ? faces.groupWord : t(`draft.sortBy.${value}`)}
            </button>
          ))}
        </div>
        {pack ? (
          <div className="lim-grid">
            {sortPack(pack, faces, sort).map((card) => {
              const index = pack.indexOf(card);
              return (
                <LimitedCard
                  key={index}
                  code={card.code}
                  foil={card.foil}
                  faces={faces}
                  showRarity
                  selected={selected === index}
                  label={t("draft.look", { name: faces.name(card.code) })}
                  onClick={() => setSelected(index)}
                  onInspect={() => {
                    setSelected(index);
                    setZoom(card);
                  }}
                />
              );
            })}
          </div>
        ) : (
          <p className="lim-empty" role="status">
            {t("draft.waiting")}
          </p>
        )}
        {pack && <p className="muted lim-small">{t("draft.hint")}</p>}
      </section>

      <ActionBar>
        {chosen ? (
          <>
            <span className="lim-bar__info" aria-live="polite">
              <b>{faces.name(chosen.code)}</b>
              <span className="muted lim-small">{line(faces.get(chosen.code), chosen.foil)}</span>
            </span>
            {take}
          </>
        ) : (
          <button type="button" className="btn btn--outline" onClick={() => setPicks(true)}>
            {t("draft.showPicks", { count: pool.length })}
          </button>
        )}
      </ActionBar>

      {picks && (
        <Sheet title={t("draft.picks", { count: pool.length })} onClose={() => setPicks(false)} theme="app">
          {pool.length === 0 ? (
            <p className="muted">{t("draft.noPicks")}</p>
          ) : (
            <div className="lim-col" style={{ gap: "0.8rem" }}>
              <GroupCounts counts={groupCounts(mainPool, faces)} faces={faces} />
              <CostCurve curve={faceCurve(mainPool, faces)} />
              <ul className="lim-list">
                {stacks(pool).map((stack) => (
                  <li key={`${stack.code}${stack.foil ? "f" : ""}`}>
                    <button
                      type="button"
                      className="lim-line"
                      onClick={() => {
                        setPicks(false);
                        setZoom({ code: stack.code, foil: stack.foil });
                      }}
                    >
                      <span className="lim-line__count">×{stack.count}</span>
                      <span className="lim-line__name">{faces.name(stack.code)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Sheet>
      )}

      <CardZoom
        code={zoom?.code ?? null}
        foil={zoom?.foil}
        faces={faces}
        onClose={() => setZoom(null)}
        action={
          zoom && chosen && zoom.code === chosen.code && Boolean(zoom.foil) === Boolean(chosen.foil) ? take : undefined
        }
      />
    </>
  );
}
