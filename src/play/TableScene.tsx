import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { EnginePlayer } from "../engine/types";

const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type TableSceneProps = {
  /** Le champ de bataille dont la caméra s'approche (un combat raconté), ou aucun. */
  dive: number | null;
  /** Les pistes de points, le long du bord gauche du plateau. */
  rails?: ReactNode;
  /** La main, à plat au premier plan, par-dessus le bas du plateau. */
  hand?: ReactNode;
  children: ReactNode;
};

/**
 * La table en relief : un plateau de feutre dans un cadre de bois et de laiton,
 * incliné comme une vraie table (CSS 3D, les cartes restent des éléments de la
 * page, cliquables et lisibles). Pendant un combat raconté, la caméra s'approche
 * du champ de bataille puis revient.
 */
export function TableScene({ dive, rails, hand, children }: TableSceneProps) {
  const scene = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);

  // La caméra : la lentille (à plat) se déplace pour amener le centre du champ
  // de bataille, tel qu'on le voit sur le plateau incliné, au centre de la
  // scène, puis grossit autour de ce point. On écrit directement le style : la
  // mesure dépend du rendu, pas de l'état.
  useLayoutEffect(() => {
    const box = scene.current;
    const glass = lens.current;
    if (!box || !glass) return;
    if (dive === null) {
      glass.removeAttribute("data-dive");
      return;
    }
    const target = glass.querySelector<HTMLElement>(`[data-bf="${dive}"]`);
    if (!target) return;
    // Mesurer sans la caméra en place : on retire le zoom le temps de la mesure.
    const zoomed = glass.hasAttribute("data-dive");
    if (zoomed) glass.style.transition = "none";
    glass.removeAttribute("data-dive");
    // Sur téléphone, le panneau des questions couvre le bas de l'écran, et la
    // barre de la table reste collée en haut.
    const sheet = document.querySelector<HTMLElement>("[data-play-sheet]");
    const sheetTop =
      sheet && getComputedStyle(sheet).position === "fixed" ? sheet.getBoundingClientRect().top : window.innerHeight;
    const bar = document.querySelector<HTMLElement>("[data-play-bar]");
    const viewTop = bar ? bar.getBoundingClientRect().bottom + 8 : 96;
    const viewBottom = Math.max(viewTop + 1, sheetTop);
    // Ce qui défile : la table en plein écran, sinon la page.
    const scroller = box.closest<HTMLElement>("[data-play-scroll]");
    const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
    const scrollMax = scroller
      ? scroller.scrollHeight - scroller.clientHeight
      : document.documentElement.scrollHeight - window.innerHeight;
    // Le champ de bataille est loin du centre de ce qu'on voit : la table défile
    // jusqu'à lui, comme la caméra qui se tourne avant d'avancer.
    let shift = 0;
    if (!zoomed) {
      const seen = target.getBoundingClientRect();
      const middle = seen.top + seen.height / 2;
      const band = (viewBottom - viewTop) / 4;
      if (middle < viewTop + band || middle > viewBottom - band) {
        const wanted = middle - (viewTop + viewBottom) / 2;
        shift = Math.max(0, Math.min(scrollMax, scrollTop + wanted)) - scrollTop;
        if (shift !== 0) (scroller ?? window).scrollBy({ top: shift, behavior: "smooth" });
      }
    }
    // Les mesures, telles qu'elles seront une fois la page défilée.
    const lensRect = glass.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const sceneRect = box.getBoundingClientRect();
    const ox = rect.left + rect.width / 2 - lensRect.left;
    const oy = rect.top + rect.height / 2 - lensRect.top;
    const top = Math.max(sceneRect.top - shift, viewTop);
    const bottom = Math.min(sceneRect.bottom - shift, viewBottom);
    const cx = sceneRect.left + sceneRect.width / 2 - lensRect.left;
    const cy = (bottom > top ? (top + bottom) / 2 + shift : sceneRect.top + sceneRect.height / 2) - lensRect.top;
    // Assez près pour que le champ de bataille remplisse ce qu'on voit, sans plus.
    const room = Math.min(sceneRect.width / Math.max(rect.width, 1), (bottom - top) / Math.max(rect.height, 1));
    const zoom = Math.max(1.15, Math.min(1.8, room * 0.85));
    glass.style.setProperty("--dive-ox", `${ox}px`);
    glass.style.setProperty("--dive-oy", `${oy}px`);
    glass.style.setProperty("--dive-x", `${cx - ox}px`);
    glass.style.setProperty("--dive-y", `${cy - oy}px`);
    glass.style.setProperty("--dive-zoom", String(zoom));
    if (zoomed) {
      void glass.offsetWidth;
      glass.style.transition = "";
    }
    glass.setAttribute("data-dive", "");
  }, [dive]);

  return (
    <div ref={scene} className="play-scene">
      <div ref={lens} className="play-lens">
        <div className="play-stage">
          <div className="play-board">
            {rails && <div className="play-rails">{rails}</div>}
            <div className="play-felt">{children}</div>
          </div>
        </div>
      </div>
      {hand && <div className="play-hand">{hand}</div>}
    </div>
  );
}

/** Les pistes de points en laiton : une par joueur, adversaires en haut, vous en bas. */
export function PointRails({
  players,
  me,
  max,
  label,
  colorOf,
}: {
  players: EnginePlayer[];
  me: number | null;
  max: number;
  label: (player: EnginePlayer) => string;
  /** La couleur des jetons de chaque joueur. */
  colorOf?: (seat: number) => string;
}) {
  const others = players.filter((player) => player.seat !== me);
  const mine = players.find((player) => player.seat === me);
  const rail = (player: EnginePlayer, own: boolean) => (
    <div
      key={player.seat}
      className={cn("play-rail", own && "play-rail-own")}
      role="img"
      aria-label={label(player)}
      title={label(player)}
      style={colorOf ? ({ "--token": colorOf(player.seat) } as CSSProperties) : undefined}
    >
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={cn("play-socket", index < player.points && "play-socket-on")} />
      ))}
    </div>
  );
  return (
    <>
      <div className="play-rails-group">{others.map((player) => rail(player, false))}</div>
      {mine && <div className="play-rails-group">{rail(mine, true)}</div>}
    </>
  );
}

/** La main en éventail : chaque carte penche un peu selon sa place et se lève au survol. */
export function HandFan({ items }: { items: { key: string | number; node: ReactNode }[] }) {
  const count = items.length;
  return (
    <div className="play-fan">
      {items.map((item, index) => (
        <div
          key={item.key}
          className="play-fan-card"
          style={{ "--fan": index - (count - 1) / 2 } as CSSProperties}
        >
          {item.node}
        </div>
      ))}
    </div>
  );
}
