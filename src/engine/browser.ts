import init, * as engine from "./pkg/joutes.js";

export type BrowserEngine = typeof engine;

let loading: Promise<BrowserEngine> | undefined;

/**
 * Le moteur de jeu dans le navigateur. Le binaire (≈ 350 Ko compressé) n'est
 * téléchargé qu'au premier appel, donc seulement par qui ouvre une table.
 */
export function loadEngine(): Promise<BrowserEngine> {
  loading ??= init().then(() => engine);
  // Un échec de téléchargement ne doit pas condamner l'onglet : le prochain
  // appel réessaie.
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}
