/**
 * Chemins des endpoints de l'API Joutes, centralisés en un seul endroit.
 *
 * ⚠️ À ALIGNER SUR LA SPEC RÉELLE : la documentation officielle
 * (https://api.joutes.app/api/docs) n'était pas accessible depuis
 * l'environnement qui a généré ce squelette. Les chemins ci-dessous sont des
 * valeurs par défaut plausibles à vérifier/corriger avant la mise en service.
 */
export const endpoints = {
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    me: "/api/auth/me",
  },
} as const;
