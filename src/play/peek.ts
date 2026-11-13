import type { PlayGame } from "../api/play";
import { loadEngine } from "../engine/browser";
import { loadSwuEngine } from "../engine/swu/browser";
import type { SwuUpdate } from "../engine/swu/types";
import type { EngineUpdate } from "../engine/types";
import type { SwuSave } from "./swu/useSwuSoloGame";
import type { SoloSave } from "./useSoloGame";

/** Où en est une partie gardée sur le téléphone, pour l'accueil de l'onglet Jouer. */
export type SavePeek = {
  game: PlayGame;
  /** Le tour (Riftbound) ou le round (SWU). */
  turn: number;
  /** Mes points et ceux du meilleur adversaire (Riftbound), ou les PV restants des bases (SWU). */
  score: [number, number] | null;
  max: number | null;
  myMove: boolean;
  finished: boolean;
};

/** Rejoue la partie dans le moteur, sans l'ouvrir : quelques millisecondes. */
export async function peekRiftbound(save: SoloSave): Promise<SavePeek | null> {
  try {
    const engine = await loadEngine();
    const table = engine.Table.restore(JSON.stringify(save.record), JSON.stringify(save.bots));
    try {
      const seat = save.seat ?? -1;
      const update = JSON.parse(table.update(seat, 0)) as EngineUpdate;
      const view = update.view;
      const mine = save.seat === null ? 0 : save.seat;
      const others = view.points.filter((_, index) => index !== mine);
      return {
        game: "riftbound",
        turn: view.turn,
        score: [view.points[mine] ?? 0, others.length ? Math.max(...others) : 0],
        max: view.victory_score,
        myMove: save.seat !== null && update.prompt !== null,
        finished: view.result !== null,
      };
    } finally {
      table.free();
    }
  } catch {
    return null;
  }
}

export async function peekSwu(save: SwuSave): Promise<SavePeek | null> {
  try {
    const engine = await loadSwuEngine();
    const table = engine.SwuTable.restore(JSON.stringify(save.record), JSON.stringify(save.bots));
    try {
      const seat = save.seat ?? -1;
      const update = JSON.parse(table.update(seat, 0)) as SwuUpdate;
      const view = update.view;
      const mine = save.seat === null ? 0 : save.seat;
      const left = (index: number) => {
        const base = view.players.find((player) => player.seat === index)?.base;
        return base ? Math.max(0, base.hp - base.damage) : 0;
      };
      return {
        game: "swu",
        turn: view.round,
        score: [left(mine), left(mine === 0 ? 1 : 0)],
        max: null,
        myMove: save.seat !== null && update.prompt !== null,
        finished: view.result !== null && view.result !== undefined,
      };
    } finally {
      table.free();
    }
  } catch {
    return null;
  }
}
