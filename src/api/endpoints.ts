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
    policies: (idOrSlug: string) => `/games/${idOrSlug}/policies`,
    policy: (idOrSlug: string, policyId: string) =>
      `/games/${idOrSlug}/policies/${policyId}`,
  },
  news: {
    list: "/news",
    detail: (newsId: string) => `/news/${newsId}`,
    like: (newsId: string) => `/news/${newsId}/like`,
  },
  events: {
    list: "/events",
    detail: (eventId: string) => `/events/${eventId}`,
    favorite: (eventId: string) => `/events/${eventId}/favorite`,
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
  trades: {
    list: "/trades",
    create: "/trades",
    join: "/trades/join",
    cards: "/trades/cards",
    detail: (tradeId: string) => `/trades/${tradeId}`,
    offer: (tradeId: string) => `/trades/${tradeId}/offer`,
    partner: (tradeId: string) => `/trades/${tradeId}/partner`,
    validate: (tradeId: string) => `/trades/${tradeId}/validate`,
  },
  users: {
    myGames: "/users/me/games",
    detail: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}`,
    wishlists: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/wishlists`,
    sellList: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/sell-list`,
  },
  tournaments: {
    /** Rejoindre via le code public d'un tournoi (`Tournament.joinCode`). */
    join: "/tournaments/join",
    /** Tournois où l'utilisateur connecté est inscrit (compte, sans clé). */
    playing: "/tournaments/playing",
    /** Résout des clés de synchronisation d'invités (`tpsk_...`) en tournois. */
    sync: "/tournaments/sync",
    detail: (tournamentId: string) => `/tournaments/${tournamentId}`,
    /** État public diffusé aux joueurs : annonces + minuteur/chronomètre (sans auth). */
    live: (tournamentId: string) => `/tournaments/${tournamentId}/live`,
    standings: (tournamentId: string) => `/tournaments/${tournamentId}/standings`,
    /** Phases, rondes, matchs et classements figés — tout l'historique en une requête. */
    history: (tournamentId: string) => `/tournaments/${tournamentId}/history`,
    player: (tournamentId: string, playerId: string) =>
      `/tournaments/${tournamentId}/players/${playerId}`,
    /** Formulaire d'inscription et réponses d'un joueur (privées : lui et l'organisation). */
    playerForm: (tournamentId: string, playerId: string) =>
      `/tournaments/${tournamentId}/players/${playerId}/form`,
    phase: (tournamentId: string, phaseId: string) =>
      `/tournaments/${tournamentId}/phases/${phaseId}`,
    /** Temps relevés sur le puzzle d'une phase (lecture et self-report). */
    puzzleResults: (tournamentId: string, phaseId: string) =>
      `/tournaments/${tournamentId}/phases/${phaseId}/puzzle-results`,
    round: (tournamentId: string, roundId: string) =>
      `/tournaments/${tournamentId}/rounds/${roundId}`,
    match: (tournamentId: string, matchId: string) =>
      `/tournaments/${tournamentId}/matches/${matchId}`,
  },
} as const;
