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

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
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
        if (value !== undefined) url.searchParams.set(key, String(value));
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
      const message =
        (typeof data === "object" &&
          data !== null &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string" &&
          (data as { message: string }).message) ||
        `Erreur ${response.status}`;
      throw new ApiError(response.status, message, data);
    }

    return data as T;
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>("POST", path, { body, query });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { query });
  }
}

export const api = new ApiClient();
