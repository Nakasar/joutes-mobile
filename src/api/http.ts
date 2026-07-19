/**
 * Abstraction du transport HTTP.
 *
 * Dans l'application Tauri (mobile ou desktop), on utilise le plugin HTTP de
 * Tauri : les requêtes partent de la couche native (Rust), ce qui évite les
 * restrictions CORS de la webview. En développement dans un simple navigateur
 * (`npm run dev` ouvert hors Tauri), on retombe sur `window.fetch`.
 */

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type HttpFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

let cachedFetch: HttpFetch | null = null;

export async function getFetch(): Promise<HttpFetch> {
  if (cachedFetch) return cachedFetch;
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    cachedFetch = tauriFetch as HttpFetch;
  } else {
    cachedFetch = window.fetch.bind(window);
  }
  return cachedFetch;
}
