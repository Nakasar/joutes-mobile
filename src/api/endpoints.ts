/**
 * Chemins des endpoints de l'API Joutes (spec OpenAPI 2.0.0,
 * https://api.joutes.app/api/docs), relatifs à `config.apiBaseUrl`.
 */
export const endpoints = {
  auth: {
    /** Better Auth — envoi d'un code OTP par e-mail. */
    sendOtp: "/auth/email-otp/send-verification-otp",
    /** Better Auth — connexion avec le code OTP reçu. */
    signInWithOtp: "/auth/sign-in/email-otp",
    signOut: "/auth/sign-out",
    getSession: "/auth/get-session",
  },
  games: {
    list: "/games",
    detail: (idOrSlug: string) => `/games/${idOrSlug}`,
    cards: (idOrSlug: string) => `/games/${idOrSlug}/cards`,
    card: (idOrSlug: string, cardId: string) =>
      `/games/${idOrSlug}/cards/${cardId}`,
    news: (idOrSlug: string) => `/games/${idOrSlug}/news`,
    sets: (idOrSlug: string) => `/games/${idOrSlug}/sets`,
    rules: (idOrSlug: string) => `/games/${idOrSlug}/rules`,
    deckChecker: (idOrSlug: string) => `/games/${idOrSlug}/deck-checker`,
  },
  news: {
    list: "/news",
    detail: (newsId: string) => `/news/${newsId}`,
    like: (newsId: string) => `/news/${newsId}/like`,
  },
  events: {
    list: "/events",
  },
  lairs: {
    list: "/lairs",
  },
  friends: {
    list: "/friends",
    requests: "/friends/requests",
  },
  playGroups: {
    list: "/play-groups",
  },
  decks: {
    list: "/decks",
    detail: (deckId: string) => `/decks/${deckId}`,
  },
  collection: {
    overview: "/collection",
    cards: "/collection/cards",
    game: (gameSlug: string) => `/collection/games/${gameSlug}`,
  },
} as const;
