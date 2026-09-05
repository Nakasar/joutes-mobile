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
    policyVote: (idOrSlug: string, policyId: string) =>
      `/games/${idOrSlug}/policies/${policyId}/vote`,
    erratas: (idOrSlug: string) => `/games/${idOrSlug}/erratas`,
    errataVote: (idOrSlug: string, errataId: string) =>
      `/games/${idOrSlug}/erratas/${errataId}/vote`,
    quizzes: (idOrSlug: string) => `/games/${idOrSlug}/quizzes`,
    /** Catalogue public des produits (boîtes, figurines…) — sans possession. */
    products: (idOrSlug: string) => `/games/${idOrSlug}/products`,
    /**
     * Cartes d'un deck résolues contre le catalogue du jeu : en GET par
     * identifiant (`?id=…&id=…`, 500 au plus), en POST par nom, pour appliquer
     * une liste collée.
     */
    deckCards: (idOrSlug: string) => `/games/${idOrSlug}/deck-cards`,
  },
  quizzes: {
    detail: (quizId: string) => `/quizzes/${quizId}`,
    scores: (quizId: string) => `/quizzes/${quizId}/scores`,
  },
  /** La recherche globale : cinq listes courtes pour une seule question. */
  search: "/search",
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
    detail: (lairId: string) => `/lairs/${lairId}`,
    /** Suivre / ne plus suivre : `PUT` et `DELETE` sur le même chemin. */
    follow: (lairId: string) => `/lairs/${lairId}/follow`,
  },
  friends: {
    list: "/friends",
    requests: "/friends/requests",
  },
  playGroups: {
    list: "/play-groups",
    detail: (playGroupId: string) => `/play-groups/${playGroupId}`,
    /** Le rôle d'armes : les groupes ouverts, et ceux qu'on suit déjà. */
    explore: "/play-groups/explore",
    showcase: (playGroupId: string) => `/play-groups/${playGroupId}/showcase`,
    /** Suivre / ne plus suivre : `PUT` et `DELETE` sur le même chemin. */
    follow: (playGroupId: string) => `/play-groups/${playGroupId}/follow`,
    sessions: (playGroupId: string) => `/play-groups/${playGroupId}/sessions`,
    session: (playGroupId: string, sessionId: string) =>
      `/play-groups/${playGroupId}/sessions/${sessionId}`,
    sessionVote: (playGroupId: string, sessionId: string) =>
      `/play-groups/${playGroupId}/sessions/${sessionId}/vote`,
    sessionConfirm: (playGroupId: string, sessionId: string) =>
      `/play-groups/${playGroupId}/sessions/${sessionId}/confirm`,
    sessionRsvp: (playGroupId: string, sessionId: string) =>
      `/play-groups/${playGroupId}/sessions/${sessionId}/rsvp`,
    announcements: (playGroupId: string) => `/play-groups/${playGroupId}/announcements`,
    announcement: (playGroupId: string, announcementId: string) =>
      `/play-groups/${playGroupId}/announcements/${announcementId}`,
    contents: (playGroupId: string) => `/play-groups/${playGroupId}/contents`,
    content: (playGroupId: string, contentId: string) =>
      `/play-groups/${playGroupId}/contents/${contentId}`,
    collection: {
      overview: (playGroupId: string) => `/play-groups/${playGroupId}/collection`,
      cards: (playGroupId: string) => `/play-groups/${playGroupId}/collection/cards`,
      card: (playGroupId: string, cardId: string) =>
        `/play-groups/${playGroupId}/collection/cards/${cardId}`,
      game: (playGroupId: string, gameSlug: string) =>
        `/play-groups/${playGroupId}/collection/games/${gameSlug}`,
      /** Recalcul de la valeur estimée de la collection commune (POST). */
      value: (playGroupId: string) => `/play-groups/${playGroupId}/collection/value`,
      gameValue: (playGroupId: string, gameSlug: string) =>
        `/play-groups/${playGroupId}/collection/games/${gameSlug}/value`,
    },
    wishlists: (playGroupId: string) => `/play-groups/${playGroupId}/wishlists`,
    sellList: (playGroupId: string) => `/play-groups/${playGroupId}/sell-list`,
    sellListItems: (playGroupId: string) =>
      `/play-groups/${playGroupId}/sell-list/items`,
  },
  decks: {
    list: "/decks",
    detail: (deckId: string) => `/decks/${deckId}`,
    /** « Copier chez moi » : la copie arrive toujours privée. */
    copy: (deckId: string) => `/decks/${deckId}/copy`,
    /**
     * Légendes réellement jouées par les decks publiés, avec leur nombre de
     * decks : la facette de la librairie sort de ce qui est publié, pas du
     * catalogue de cartes.
     */
    legends: "/decks/legends",
  },
  collection: {
    overview: "/collection",
    cards: "/collection/cards",
    card: (cardId: string) => `/collection/cards/${cardId}`,
    game: (gameSlug: string) => `/collection/games/${gameSlug}`,
    /**
     * Recalcul de la valeur estimée (POST) : de toute la collection, ou d'un
     * seul jeu. Le serveur l'enregistre, elle ne bouge qu'à ce moment-là.
     */
    value: "/collection/value",
    gameValue: (gameSlug: string) => `/collection/games/${gameSlug}/value`,
    /** Catalogue de produits d'un jeu, annoté de ce que l'appelant possède. */
    gameProducts: (gameSlug: string) => `/collection/games/${gameSlug}/products`,
    gameProduct: (gameSlug: string, productId: string) =>
      `/collection/games/${gameSlug}/products/${productId}`,
    /** Exemplaires de produits : ajout (le jeu passe en query, un id n'étant unique qu'au sein d'un jeu). */
    products: "/collection/products",
    productEntry: (entryId: string) => `/collection/products/${entryId}`,
  },
  gameMatches: {
    /** Parties de l'utilisateur connecté (lecture) et enregistrement (écriture). */
    list: "/game-matches",
    detail: (matchId: string) => `/game-matches/${matchId}`,
    /** Table de jeu d'un rapport de bataille : écrite d'un bloc, par le créateur. */
    battleMap: (matchId: string) => `/game-matches/${matchId}/battle-map`,
    /** Rejoindre une partie sur invitation (QR code). En POST, la réponse est en JSON. */
    join: (matchId: string) => `/game-matches/${matchId}/join`,
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
    /**
     * Apparie une liste de cartes écrite en texte à des impressions réelles.
     * L'appariement se fait côté serveur : l'application n'a ni la collection
     * ni le catalogue, et les télécharger pour lire trente lignes coûterait
     * très cher une commodité.
     */
    resolveCards: "/trades/cards/resolve",
    detail: (tradeId: string) => `/trades/${tradeId}`,
    offer: (tradeId: string) => `/trades/${tradeId}/offer`,
    partner: (tradeId: string) => `/trades/${tradeId}/partner`,
    validate: (tradeId: string) => `/trades/${tradeId}/validate`,
  },
  users: {
    myGames: "/users/me/games",
    /** Permissions effectives du compte connecté (publication de policies…). */
    myPermissions: "/users/me/permissions",
    /** Le registre de la communauté : les comptes qui ont ouvert leur vitrine. */
    list: "/users",
    /** Le classement des succès, et le rang de l'appelant. */
    leaderboard: "/users/leaderboard",
    detail: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}`,
    wishlists: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/wishlists`,
    sellList: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/sell-list`,
    /**
     * Suivre, ou cesser de suivre. Deux verbes idempotents (`PUT` / `DELETE`)
     * plutôt qu'une bascule : deux envois partis d'un double toucher
     * laisseraient sinon l'abonnement dans l'état contraire à celui voulu.
     */
    follow: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/follow`,
    /** Tous les succès, décrochés ou non — le profil ne porte que les premiers. */
    achievements: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/achievements`,
    contents: (userTagOrId: string) =>
      `/users/${encodeURIComponent(userTagOrId)}/contents`,
  },
  notifications: {
    list: "/notifications",
    unreadCount: "/notifications/unread-count",
    readAll: "/notifications/read-all",
    read: (notificationId: string) => `/notifications/${notificationId}/read`,
    hide: (notificationId: string) => `/notifications/${notificationId}/hide`,
    /** Enregistrement d'un appareil pour le push, et liste des siens. */
    devices: "/notifications/devices",
    device: (deviceId: string) => `/notifications/devices/${deviceId}`,
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
