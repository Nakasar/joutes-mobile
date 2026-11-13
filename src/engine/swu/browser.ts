import init, * as engine from "./pkg/joutes_swu.js";

export type SwuBrowserEngine = typeof engine;

let loading: Promise<SwuBrowserEngine> | undefined;

/**
 * Le moteur de Star Wars: Unlimited dans le navigateur. Comme celui de
 * Riftbound, son binaire n'est téléchargé qu'au premier appel.
 */
export function loadSwuEngine(): Promise<SwuBrowserEngine> {
  loading ??= init().then(() => engine);
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}
