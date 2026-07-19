/**
 * Types des données échangées avec l'API Joutes.
 *
 * ⚠️ À ALIGNER SUR LA SPEC RÉELLE (https://api.joutes.app/api/docs) : la
 * documentation n'était pas accessible depuis l'environnement qui a généré ce
 * squelette. Ces types sont un point de départ minimal.
 */

export interface User {
  id: string;
  username?: string;
  email?: string;
  [key: string]: unknown;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  /** Token d'accès (Bearer). Adapter le nom du champ à la réponse réelle. */
  token?: string;
  accessToken?: string;
  access_token?: string;
  user?: User;
  [key: string]: unknown;
}
