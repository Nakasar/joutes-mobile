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

/**
 * Connexion par un code de la page « Se connecter dans l'app » du site
 * (`/app-login`), ouverte dans le navigateur : c'est le chemin des comptes
 * Discord, que l'app ne sait pas ouvrir elle-même. Le code sert une fois ;
 * le serveur pose le cookie de la session du navigateur.
 */
export function signInWithAppCode(code: string): Promise<unknown> {
  return api.post(endpoints.auth.verifyAppCode, { token: normalizeAppCode(code) });
}

/** « abcd-efgh » → « ABCDEFGH » : la forme que le site a générée. */
export function normalizeAppCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function signOut(): Promise<unknown> {
  return api.post(endpoints.auth.signOut, {});
}

/** Renvoie la session courante, ou null si non connecté. */
export function getSession(): Promise<Session | null> {
  return api.get<Session | null>(endpoints.auth.getSession);
}
