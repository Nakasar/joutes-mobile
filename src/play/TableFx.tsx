import { useEffect, useMemo, useRef } from "react";

import { FxEngine, type FxCardInfo } from "./fx-engine";
import { fxFor, type FxDefs } from "../engine/card-fx";
import type { TableCards } from "../engine/cards";
import { SPEED_FACTOR, type PaceSettings } from "../engine/pacing";
import { DOMAIN_HEX } from "../engine/told-text";
import type { EngineTold } from "../engine/types";

/**
 * Les effets des cartes sur la table : à chaque évènement raconté, le geste
 * qu'il montre (frapper, mourir, renforcer…) dans la matière de la carte qui
 * se résout. Coupés en « Instantané » ou avec le réglage « Effets des cartes »
 * décoché (décoché d'office quand le système demande moins d'animations, tant
 * qu'on ne l'a pas coché soi-même).
 */
export function TableFx({
  current,
  journal,
  cards,
  me,
  pace,
}: {
  /** L'évènement au premier plan et sa place dans `journal`. */
  current: { entry: EngineTold; index: number } | null;
  /** Le journal entier de la partie (une carte qui se résout regarde ce qui la suit). */
  journal: EngineTold[];
  cards: TableCards;
  me: number | null;
  pace: PaceSettings;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const engine = useRef<FxEngine | null>(null);
  const seen = useRef(-1);

  const enabled = pace.effects && pace.speed !== "instant";

  // Les cartes par leur numéro dans le moteur.
  const byDef = useMemo(() => {
    const out = new Map<number, { info: FxCardInfo; matter: NonNullable<TableCards[string]["fx"]> | "domaine"; spell: boolean }>();
    for (const card of Object.values(cards)) {
      if (card.def === undefined) continue;
      const color = DOMAIN_HEX[card.domains[0]?.toLowerCase() ?? ""] ?? "#94a3b8";
      out.set(card.def, {
        info: { name: card.name, image: card.image, color, landscape: card.landscape },
        matter: card.fx ?? "domaine",
        spell: card.kind === "spell",
      });
    }
    return out;
  }, [cards]);

  useEffect(() => {
    if (!canvas.current || !layer.current) return;
    const root = () => layer.current?.closest("[data-play-scroll]") ?? document;
    const fx = new FxEngine(canvas.current, layer.current, root);
    engine.current = fx;
    const resize = () => fx.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      fx.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const fx = engine.current;
    if (!fx) return;
    fx.scale = Math.max(0.5, SPEED_FACTOR[pace.speed] || 1);
    if (!enabled) fx.clear();
  }, [enabled, pace.speed]);

  useEffect(() => {
    const fx = engine.current;
    if (!fx || !current) return;
    const index = current.index;
    // Une nouvelle partie recommence le journal.
    if (index < seen.current) fx.clear();
    if (index === seen.current) return;
    seen.current = index;
    if (!enabled || document.hidden) return;
    const defs: FxDefs = (def) => {
      const card = byDef.get(def);
      return card ? { matter: card.matter, color: card.info.color, spell: card.spell } : null;
    };
    const info = (def: number) => byDef.get(def)?.info ?? null;
    for (const command of fxFor(journal, index, defs, me)) void fx.play(command, info, me);
  }, [current, journal, byDef, me, enabled]);

  return (
    <div ref={layer} aria-hidden className="pt-fx">
      <canvas ref={canvas} className="pt-fx__canvas" />
    </div>
  );
}
