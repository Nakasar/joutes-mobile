/**
 * Configuration globale de l'application.
 */
export const config = {
  /**
   * URL de base de l'API Joutes (spec OpenAPI 2.0.0).
   * Le serveur de production déclaré dans la spec est `https://joutes.app/api`,
   * également servi sur `https://api.joutes.app/api`.
   */
  apiBaseUrl: import.meta.env.VITE_JOUTES_API_URL ?? "https://api.joutes.app/api",
  /** Site web Joutes. */
  webUrl: "https://joutes.app",
  /** Documentation de l'API. */
  apiDocsUrl: "https://api.joutes.app/api/docs",
};
