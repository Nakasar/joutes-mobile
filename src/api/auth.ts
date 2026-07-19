import { api } from "./client";
import { endpoints } from "./endpoints";
import type { LoginRequest, LoginResponse, User } from "./types";

/** Extrait le token quel que soit le nom de champ utilisé par l'API. */
export function extractToken(response: LoginResponse): string | null {
  return (
    response.token ?? response.accessToken ?? response.access_token ?? null
  );
}

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return api.post<LoginResponse>(endpoints.auth.login, credentials, {
    anonymous: true,
  });
}

export function logout(): Promise<void> {
  return api.post<void>(endpoints.auth.logout);
}

export function fetchCurrentUser(): Promise<User> {
  return api.get<User>(endpoints.auth.me);
}
