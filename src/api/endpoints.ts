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
    exports: (idOrSlug: string) => `/games/${idOrSlug}/exports`,
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
    detail: (playGroupId: string) => `/play-groups/${playGroupId}`,
    collection: {
      overview: (playGroupId: string) => `/play-groups/${playGroupId}/collection`,
      cards: (playGroupId: string) => `/play-groups/${playGroupId}/collection/cards`,
      card: (playGroupId: string, cardId: string) =>
        `/play-groups/${playGroupId}/collection/cards/${cardId}`,
      game: (playGroupId: string, gameSlug: string) =>
        `/play-groups/${playGroupId}/collection/games/${gameSlug}`,
    },
    wishlists: (playGroupId: string) => `/play-groups/${playGroupId}/wishlists`,
    sellList: (playGroupId: string) => `/play-groups/${playGroupId}/sell-list`,
    sellListItems: (playGroupId: string) =>
      `/play-groups/${playGroupId}/sell-list/items`,
  },
  decks: {
    list: "/decks",
    detail: (deckId: string) => `/decks/${deckId}`,
  },
  collection: {
    overview: "/collection",
    cards: "/collection/cards",
    card: (cardId: string) => `/collection/cards/${cardId}`,
    game: (gameSlug: string) => `/collection/games/${gameSlug}`,
  },
  wishlists: {
    mine: "/wishlists/mine",
    list: "/wishlists",
    detail: (wishlistId: string) => `/wishlists/${wishlistId}`,
    items: (wishlistId: string) => `/wishlists/${wishlistId}/items`,
    item: (wishlistId: string, itemId: string) =>
      `/wishlists/${wishlistId}/items/${itemId}`,
  },
  sellLists: {
    mine: "/sell-lists/mine",
    mineItems: "/sell-lists/mine/items",
    detail: (sellListId: string) => `/sell-lists/${sellListId}`,
    items: (sellListId: string) => `/sell-lists/${sellListId}/items`,
    item: (sellListId: string, itemId: string) =>
      `/sell-lists/${sellListId}/items/${itemId}`,
  },
  users: {
    detail: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}`,
    wishlists: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/wishlists`,
    sellList: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/sell-list`,
  },
  tournaments: {
    sync: "/tournaments/sync",
    detail: (tournamentId: string) => `/tournaments/${tournamentId}`,
    standings: (tournamentId: string) => `/tournaments/${tournamentId}/standings`,
    phase: (tournamentId: string, phaseId: string) =>
      `/tournaments/${tournamentId}/phases/${phaseId}`,
    round: (tournamentId: string, roundId: string) =>
      `/tournaments/${tournamentId}/rounds/${roundId}`,
    match: (tournamentId: string, matchId: string) =>
      `/tournaments/${tournamentId}/matches/${matchId}`,
  },
} as const;
