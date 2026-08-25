import { config } from "../config";
import { getFetch, isTauri } from "./http";

/** Erreur renvoyée par l'API Joutes. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Paramètres de requête.
 *
 * Un tableau produit **le même paramètre répété** (`?domain=fury&domain=body`)
 * et non une valeur unique séparée par des virgules : c'est la forme qu'attend
 * l'API, qui les relit par `searchParams.getAll` — la librairie de decks filtre
 * ainsi sur plusieurs domaines ou plusieurs visibilités à la fois. Un tableau
 * vide n'écrit rien, comme `undefined` : un filtre sans valeur ne se distingue
 * pas d'un filtre absent.
 */
type QueryParams = Record<
  string,
  string | number | boolean | readonly string[] | undefined
>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Client HTTP de l'API Joutes : URL de base, sérialisation JSON et conversion
 * des erreurs.
 *
 * L'authentification repose sur le cookie de session Better Auth
 * (`better-auth.session_token`) posé par les endpoints `/auth/*` :
 * - dans l'app Tauri, le cookie est géré et persisté nativement par le plugin
 *   HTTP (feature `cookies` de reqwest), le JS n'y touche jamais ;
 * - en développement navigateur, `credentials: "include"` laisse le
 *   navigateur gérer le cookie (soumis au CORS du serveur).
 */
class ApiClient {
  private onUnauthorized: (() => void) | null = null;

  /** Callback appelé quand l'API répond 401 (session expirée). */
  setUnauthorizedHandler(handler: (() => void) | null) {
    this.onUnauthorized = handler;
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    // Concaténation simple : `new URL(path, base)` écraserait le préfixe
    // `/api` de l'URL de base avec un chemin absolu.
    const url = new URL(config.apiBaseUrl.replace(/\/$/, "") + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          // `append`, et non `set` : c'est toute la différence entre trois
          // filtres cumulés et le dernier des trois.
          for (const item of value) url.searchParams.append(key, item);
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    // La protection CSRF de Better Auth exige un Origin de confiance sur les
    // écritures authentifiées. Le transport natif Tauri n'en envoie aucun par
    // défaut ; dans un navigateur, l'en-tête est interdit et celui du
    // navigateur s'applique.
    if (isTauri()) {
      headers["Origin"] = config.trustedOrigin;
    }
    // Auth alternative au cookie de session : clé de synchronisation d'un
    // joueur de tournoi invité (`tpsk_...`), transmise explicitement par
    // l'appelant.
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const fetch = await getFetch();
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        credentials: "include",
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      throw new ApiError(
        0,
        "Impossible de joindre le serveur Joutes. Vérifiez votre connexion.",
        error,
      );
    }

    if (response.status === 401) {
      this.onUnauthorized?.();
    }

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      // L'API Joutes renvoie le libellé d'erreur tantôt dans `message`
      // (Better Auth), tantôt dans `error` (routes REST).
      const field = (key: "message" | "error"): string | undefined =>
        typeof data === "object" &&
        data !== null &&
        key in data &&
        typeof (data as Record<string, unknown>)[key] === "string"
          ? (data as Record<string, string>)[key]
          : undefined;
      const message =
        field("message") || field("error") || `Erreur ${response.status}`;
      throw new ApiError(response.status, message, data);
    }

    return data as T;
  }

  get<T>(path: string, query?: QueryParams, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, { query, headers });
  }

  post<T>(
    path: string,
    body?: unknown,
    query?: QueryParams,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("POST", path, { body, query, headers });
  }

  put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PUT", path, { body, headers });
  }

  patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PATCH", path, { body, headers });
  }

  delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }
}

export const api = new ApiClient();
