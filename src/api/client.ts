import { config } from "../config";
import { getFetch } from "./http";

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
  /** Ne pas envoyer le token même si l'utilisateur est connecté. */
  anonymous?: boolean;
}

/**
 * Client HTTP de l'API Joutes : gère l'URL de base, la sérialisation JSON,
 * le token d'authentification (Bearer) et la conversion des erreurs.
 */
class ApiClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /** Callback appelé quand l'API répond 401 (session expirée). */
  setUnauthorizedHandler(handler: (() => void) | null) {
    this.onUnauthorized = handler;
  }

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(path, config.apiBaseUrl);
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
    if (this.token && !options.anonymous) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const fetch = await getFetch();
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
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

    if (response.status === 401 && !options.anonymous) {
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

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }
}

export const api = new ApiClient();
