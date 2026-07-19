/**
 * Configuration globale de l'application.
 */
export const config = {
  /** URL de base de l'API Joutes. */
  apiBaseUrl: import.meta.env.VITE_JOUTES_API_URL ?? "https://api.joutes.app",
  /** Site web Joutes. */
  webUrl: "https://joutes.app",
  /** Documentation de l'API. */
  apiDocsUrl: "https://api.joutes.app/api/docs",
};
