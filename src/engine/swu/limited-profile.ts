import type { LimitedProfile } from "../limited-profile";
import { loadSwuEngine } from "./browser";
import { swuLimitedRules } from "./limited";

export const SWU_LIMITED_STORAGE_KEY = "joutes.play.swu.limited";

/** Le scellé et le draft de Star Wars: Unlimited (Comprehensive Rules, section 10). */
export const swuLimited: LimitedProfile = {
  game: "swu",
  words: "swu",
  base: "/play/swu",
  storageKey: SWU_LIMITED_STORAGE_KEY,
  rules: swuLimitedRules,
  engine: async () => {
    const engine = await loadSwuEngine();
    return {
      sets: () => JSON.parse(engine.swu_booster_sets()),
      create: (settings, seed) => new engine.SwuLimitedEvent(JSON.stringify(settings), seed),
      restore: (record) => engine.SwuLimitedEvent.restore(record),
    };
  },
};
