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
    /** Better Auth — échange du code affiché par la page /app-login du site. */
    verifyAppCode: "/auth/one-time-token/verify",
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
    /** Le direct de l'éditeur, s'il diffuse : à part du catalogue, qui se garde longtemps. */
    live: (idOrSlug: string) => `/games/${idOrSlug}/live`,
    /** Les publications de l'éditeur sur ses réseaux (404 sans `features.socialFeed`). */
    socialPosts: (idOrSlug: string) => `/games/${idOrSlug}/social-posts`,
    /** Catalogue public des produits (boîtes, figurines…) — sans possession. */
    products: (idOrSlug: string) => `/games/${idOrSlug}/products`,
    /**
     * Cartes d'un deck résolues contre le catalogue du jeu : en GET par
     * identifiant (`?id=…&id=…`, 500 au plus), en POST par nom, pour appliquer
     * une liste collée.
     */
    deckCards: (idOrSlug: string) => `/games/${idOrSlug}/deck-cards`,
    /** Les cartes d'une extension, que le scanner d'un booster reconnaît en mémoire. */
    scannerSetCards: (idOrSlug: string) => `/games/${idOrSlug}/scanner/set-cards`,
    /** Identification d'une photo de carte par l'IA (permission `scanner:ai`). */
    scannerAiMatch: (idOrSlug: string) => `/games/${idOrSlug}/scanner/ai-match`,
    /** La méta du jeu : `period`, `legend`, `domain`, `source` (404 si fermée). */
    meta: (idOrSlug: string) => `/games/${idOrSlug}/meta`,
    metaTournament: (idOrSlug: string, date: string, slug: string) =>
      `/games/${idOrSlug}/meta/tournaments/${date}/${encodeURIComponent(slug)}`,
  },
  quizzes: {
    detail: (quizId: string) => `/quizzes/${quizId}`,
    scores: (quizId: string) => `/quizzes/${quizId}/scores`,
  },
  /** La recherche globale : cinq listes courtes pour une seule question. */
  search: "/search",
  /** L'accueil en une requête : jeux, directs, agenda, fil, lieux, decks. */
  feed: "/feed",
  news: {
    list: "/news",
    detail: (newsId: string) => `/news/${newsId}`,
    like: (newsId: string) => `/news/${newsId}/like`,
  },
  geo: {
    /** Villes et codes postaux, pour dire où l'on est sans GPS. */
    places: "/geo/places",
  },
  events: {
    list: "/events",
    detail: (eventId: string) => `/events/${eventId}`,
    favorite: (eventId: string) => `/events/${eventId}/favorite`,
    /** Liste d'attente : `POST` pour la rejoindre, `DELETE` pour la quitter. */
    /** Inscription : `POST` pour s'inscrire, `DELETE` pour se désinscrire. */
    registration: (eventId: string) => `/events/${eventId}/registration`,
    waitlist: (eventId: string) => `/events/${eventId}/waitlist`,
    waitlistAccept: (eventId: string) => `/events/${eventId}/waitlist/accept`,
    waitlistDecline: (eventId: string) => `/events/${eventId}/waitlist/decline`,
  },
  lairs: {
    list: "/lairs",
    detail: (lairId: string) => `/lairs/${lairId}`,
    /** Suivre / ne plus suivre : `PUT` et `DELETE` sur le même chemin. */
    follow: (lairId: string) => `/lairs/${lairId}/follow`,
    /** Ce qu'on reçoit d'un lieu suivi : `GET` et `PUT`. */
    notifications: (lairId: string) => `/lairs/${lairId}/notifications`,
  },
  friends: {
    /** `GET` la liste, `POST { username }` envoie une demande (pseudo#1234). */
    list: "/friends",
    requests: "/friends/requests",
    /** `POST` accepte la demande, `DELETE` la refuse. */
    request: (requestId: string) => `/friends/requests/${requestId}`,
    /** Mon code ami (`GET`), celui que montre mon QR. */
    code: "/friends/code",
    /** `POST { code }` : ajout immédiat par le code ami d'un autre joueur. */
    scan: "/friends/scan",
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
    /** La bibliothèque de decks du groupe : lire, partager (POST), retirer (DELETE ?deckId=). */
    decks: (playGroupId: string) => `/play-groups/${playGroupId}/decks`,
    /** La timeline des tournois des membres, page par page (`avant=AAAA-MM`). */
    tournaments: (playGroupId: string) => `/play-groups/${playGroupId}/tournaments`,
    /** La méta du groupe : `jeu`, `ext` (extension ou `tout`), `membre`, `comparer=0`. */
    meta: (playGroupId: string) => `/play-groups/${playGroupId}/meta`,
    /** Inviter un joueur (POST `userIdentifier` : tag ou e-mail). */
    members: (playGroupId: string) => `/play-groups/${playGroupId}/members`,
    /** Changer le rôle (PATCH `role`) ou retirer (DELETE) un membre, par son id de compte. */
    member: (playGroupId: string, userId: string) =>
      `/play-groups/${playGroupId}/members/${encodeURIComponent(userId)}`,
    /** Téléverser l'emblème ou la bannière (POST multipart `file`). */
    images: (playGroupId: string) => `/play-groups/${playGroupId}/images`,
    /** Mes invitations en attente ; les accepter (POST sur l'invitation). */
    invitations: "/play-groups/invitations",
    invitation: (invitationId: string) =>
      `/play-groups/invitations/${encodeURIComponent(invitationId)}`,
  },
  decks: {
    list: "/decks",
    detail: (deckId: string) => `/decks/${deckId}`,
    /** « Copier chez moi » : la copie arrive toujours privée. */
    copy: (deckId: string) => `/decks/${deckId}/copy`,
    /** Déposer l'image de couverture (POST multipart `file`) ; un PATCH l'inscrit ensuite. */
    cover: (deckId: string) => `/decks/${deckId}/cover`,
    /** Résultats en tournoi liés au deck et lien d'achat CardNexus. */
    extras: (deckId: string) => `/decks/${deckId}/extras`,
    /**
     * Légendes réellement jouées par les decks publiés, avec leur nombre de
     * decks : la facette de la librairie sort de ce qui est publié, pas du
     * catalogue de cartes.
     */
    legends: "/decks/legends",
    /** Le fil de commentaires d'un deck dans un espace (`personal` ou `group:<id>`). */
    comments: (deckId: string) => `/decks/${deckId}/comments`,
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
    /** Exemplaires possédés par nom de carte, toutes impressions confondues (120 noms au plus). */
    ownership: (gameSlug: string) => `/collection/games/${gameSlug}/ownership`,
    /** Ajout d'une extension entière : liste des extensions (GET), aperçu ou ajout (POST). */
    quickAdd: (gameSlug: string) => `/collection/games/${gameSlug}/quick-add`,
    /** Import d'un fichier CSV (POST, `dryRun` pour vérifier sans écrire). */
    import: (gameSlug: string) => `/collection/games/${gameSlug}/import`,
    /** Export CSV (GET), au format et sur le contenu demandés. */
    export: (gameSlug: string) => `/collection/games/${gameSlug}/export`,
    /** Annulation d'un ajout groupé (DELETE). */
    batch: (batchId: string) => `/collection/batches/${batchId}`,
    /** Catalogue de produits d'un jeu, annoté de ce que l'appelant possède. */
    gameProducts: (gameSlug: string) => `/collection/games/${gameSlug}/products`,
    gameProduct: (gameSlug: string, productId: string) =>
      `/collection/games/${gameSlug}/products/${productId}`,
    /** Exemplaires de produits : ajout (le jeu passe en query, un id n'étant unique qu'au sein d'un jeu). */
    products: "/collection/products",
    productEntry: (entryId: string) => `/collection/products/${entryId}`,
    /** Boosters ouverts : liste (`?gameSlug=`) et création (POST). */
    boosters: "/collection/boosters",
    /** Un booster : lecture, `PATCH { type, note }`, suppression. */
    booster: (boosterId: string) => `/collection/boosters/${boosterId}`,
    /** Cartes d'un booster : ajout (POST), foil (`PATCH { entryId, foil }`), retrait (`DELETE ?entryId=`). */
    boosterCards: (boosterId: string) => `/collection/boosters/${boosterId}/cards`,
    /** Verser le booster dans la collection (POST) ou l'en retirer (DELETE). */
    boosterCollection: (boosterId: string) => `/collection/boosters/${boosterId}/collection`,
    /** Recalcul de la valeur du booster (POST). */
    boosterValue: (boosterId: string) => `/collection/boosters/${boosterId}/value`,
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
    /** Suivre / ne plus suivre un jeu : `PUT` et `DELETE` sur le même chemin. */
    myGame: (idOrSlug: string) => `/users/me/games/${idOrSlug}`,
    myGameFavorite: (idOrSlug: string) => `/users/me/games/${idOrSlug}/favorite`,
    /** Permissions effectives du compte connecté (publication de policies…). */
    myPermissions: "/users/me/permissions",
    /** Le profil modifiable : pseudo, avatar, localité, notifications (GET, PATCH). */
    myProfile: "/users/me/profile",
    /** Dépôt d'une image du compte (POST multipart `file`, `kind=avatar`). */
    myUpload: "/users/me/upload",
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
