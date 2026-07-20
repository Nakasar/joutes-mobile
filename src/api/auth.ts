import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Session } from "./types";

/**
 * Authentification Better Auth par code OTP envoyé par e-mail.
 * Le cookie de session est posé par le serveur à la connexion et géré par la
 * couche transport (voir `client.ts`) — rien à stocker côté JS.
 */

/** Étape 1 : envoie un code de connexion à l'adresse indiquée. */
export function sendSignInOtp(email: string): Promise<unknown> {
  return api.post(endpoints.auth.sendOtp, { email, type: "sign-in" });
}

/** Étape 2 : valide le code reçu, le serveur pose le cookie de session. */
export function signInWithOtp(email: string, otp: string): Promise<unknown> {
  return api.post(endpoints.auth.signInWithOtp, { email, otp });
}

export function signOut(): Promise<unknown> {
  return api.post(endpoints.auth.signOut, {});
}

/** Renvoie la session courante, ou null si non connecté. */
export function getSession(): Promise<Session | null> {
  return api.get<Session | null>(endpoints.auth.getSession);
}
