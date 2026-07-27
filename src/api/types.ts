/**
 * Types des données échangées avec l'API Joutes (spec OpenAPI 2.0.0).
 * Vérifiés contre l'API réelle le 2026-07-19 — noter que `GET /games`
 * renvoie `_id` (et non `id` comme indiqué dans la spec).
 */

// ---- Auth (Better Auth) ----

export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  displayName?: string;
  discriminator?: string;
  image?: string;
  [key: string]: unknown;
}

/** Réponse de GET /auth/get-session (null si non connecté). */
export interface Session {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: string;
    [key: string]: unknown;
  };
}

// ---- Jeux ----

/** Clé de type de jeu (`lib/constants/game-types.ts` côté joutes-app). */
export type GameTypeKey = "TCG" | "BoardGame" | "VideoGame" | "Miniatures" | "Other";

export interface GameSummary {
  /** L'API renvoie `_id` sur GET /games. */
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  banner?: string;
  // `& {}` empêche TS de réduire l'union à `string` : les clés connues
  // gardent l'auto-complétion, tout en acceptant une valeur backend inconnue.
  type?: GameTypeKey | (string & {});
}

export interface Game extends GameSummary {
  longDescription?: string;
  color?: string;
  images?: {
    icon?: string;
    horizontal?: string;
    vertical?: string;
    banner?: string;
  };
  links?: Record<string, string>;
  gallery?: string[];
  metadata?: {
    publisher?: string;
    releaseDate?: string;
    players?: { min?: number; max?: number };
    playingTimeMinutes?: { min?: number; max?: number };
  };
  formats?: { name: string }[];
  stats?: { communityRating?: number; popularityScore?: number };
  /** Fonctionnalités activées pour ce jeu côté backend (toutes optionnelles/absentes = désactivées). */
  features?: {
    cards?: boolean;
    collection?: boolean;
    rules?: boolean;
    policies?: boolean;
    tournaments?: boolean;
    deckChecker?: boolean;
  };
  [key: string]: unknown;
}

// ---- Cartes ----

/**
 * Carte du catalogue d'un jeu. Outre les champs communs ci-dessous, l'API
 * renvoie des attributs propres à chaque jeu (ex. `Domain`, `Set`, `face`
 * pour Riftbound) — accessibles via la signature d'index.
 */
export interface Card {
  id: string;
  name: string;
  subtitle?: string;
  type?: string;
  cost?: number;
  image?: string;
  setCode?: string;
  collectorNumber?: string;
  lang?: string;
  text?: string;
  banned?: boolean;
  isToken?: boolean;
  [key: string]: unknown;
}

export interface CardsSearchResponse {
  cards: Card[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Facettes disponibles pour filtrer. */
  setCodes?: string[];
  types?: string[];
  languages?: string[];
}

export type ErrataType = "errata" | "clarification" | "ruling";

export interface Errata {
  id: string;
  cardIds?: string[];
  type: ErrataType;
  /** Texte original (markdown). */
  details: string;
  originalLang?: string;
  translations?: { lang: string; details: string; updatedAt?: string }[];
  source?: string;
  errataDate?: string;
  contentUpdatedAt?: string;
  deprecatedAt?: string;
  votes?: { positive?: number; negative?: number; userVote?: string };
}

export type PolicyVoteType = "positive" | "negative";

/**
 * Politique / clarification d'organisation de tournoi propre à un jeu
 * (`GET /games/{idOrSlug}/policies`). Structure proche d'`Errata`, mais
 * titrée et non liée à des cartes.
 */
export interface Policy {
  id: string;
  title: string;
  /** Texte original (markdown). */
  content: string;
  originalLang?: string;
  translations?: { lang: string; title: string; content: string; updatedAt?: string }[];
  gameId: string;
  game?: { id?: string; name?: string; slug?: string };
  source?: string;
  contentUpdatedAt?: string;
  createdAt?: string;
  deprecatedAt?: string;
  votes?: { positive?: number; negative?: number; userVote?: PolicyVoteType };
}

export interface CardDetail extends Card {
  game?: { id?: string; name?: string; slug?: string };
  erratas?: Errata[];
  /** Liens nom de carte → id, pour résoudre les références dans les erratas. */
  cardIdByName?: Record<string, string>;
}

export interface GameSet {
  setCode: string;
  name: string;
  maxCollectorNumber?: number;
  cardMaxNumber?: number;
}

// ---- Règles ----

export type RuleDocument = "TR" | "CR";
export type RuleLang = "en" | "fr";

/**
 * Entrée d'un document de règles (titre / mot-clé / paragraphe). `markup`
 * utilise un petit format de pseudo-balises (`{{rule id="…"}}`,
 * `{{keyword id="…"}}`, `{{match}}…{{/match}}`), à parser côté client — jamais
 * du HTML. Voir `lib/rules-markup.ts`.
 */
export interface RuleEntry {
  id: string;
  content: string;
  markup: string;
  isTitle: boolean;
  isKeyword: boolean;
  depth: number;
  document: RuleDocument;
  /** Présents uniquement en mode recherche. */
  sectionId?: string;
  matched?: boolean;
}

// ---- News ----

export interface NewsGameRef {
  id: string;
  name: string;
  icon?: string;
  slug: string;
}

export interface News {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  banner?: string;
  gameIds?: string[];
  games?: NewsGameRef[];
  tags?: string[];
  author?: { id: string; displayName?: string; discriminator?: string };
  likesCount?: number;
  userHasLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewsListResponse {
  news: News[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  tags?: string[];
}

// ---- Événements ----

export type EventStatus = "available" | "sold-out" | "cancelled";
export type EventRegistrationStatus =
  | "NOT_REGISTERED"
  | "PRE_REGISTERED"
  | "REGISTERED"
  | "EXCLUDED";

export interface JoutesEvent {
  id: string;
  lairId?: string;
  name: string;
  description?: string;
  startDateTime: string;
  endDateTime?: string;
  gameName?: string;
  game?: { name?: string; icon?: string; banner?: string; slug?: string };
  url?: string;
  price?: number;
  status?: EventStatus;
  runningState?: "not-started" | "ongoing" | "completed";
  allowJoin?: boolean;
  preRegistration?: boolean;
  /** IDs des utilisateurs inscrits. Présent en liste comme au détail. */
  participants?: string[];
  /** Présent au détail et sur la liste des événements d'un compte connecté ; absent de la recherche géospatiale par lair. */
  participantRegistrations?: Record<string, EventRegistrationStatus>;
  registeredParticipantsCount?: number;
  maxParticipants?: number;
  /** IDs des utilisateurs ayant mis l'évènement en favori. Présent en liste comme au détail. */
  favoritedBy?: string[];
  lair?: { id?: string; name?: string; address?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface EventsListResponse {
  events: JoutesEvent[];
}

// ---- Social (amis, groupes) ----

export interface PublicUser {
  id: string;
  username?: string;
  displayName?: string;
  discriminator?: string;
  avatar?: string;
}

export interface PublicUserGame {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
}

export interface PublicUserLair {
  id: string;
  name: string;
  address?: string;
}

export interface PublicUserAchievement {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  points?: number;
  unlockedAt?: string;
}

/**
 * Profil public d'un utilisateur (`GET /users/{tag}`). `description`/`website`/
 * `socialLinks` sont toujours présents ; `games`/`lairs`/`achievements` ne sont
 * peuplés que si `isPublicProfile` est vrai (tableaux vides sinon).
 */
export interface PublicUserProfile extends PublicUser {
  description: string | null;
  website: string | null;
  socialLinks: string[];
  isPublicProfile: boolean;
  games: PublicUserGame[];
  lairs: PublicUserLair[];
  achievements: PublicUserAchievement[];
}

export interface FriendRequest {
  id: string;
  requester?: PublicUser;
  [key: string]: unknown;
}

export interface PlayGroupMember {
  userId?: string;
  role?: string;
  user?: PublicUser;
  [key: string]: unknown;
}

export interface PlayGroup {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  enabledGameIds?: string[] | null;
  members?: PlayGroupMember[];
  createdAt?: string;
  updatedAt?: string;
}

// ---- Lairs (boutiques / lieux) ----

export interface Lair {
  id: string;
  name: string;
  banner?: string;
  games?: string[];
  address?: string;
  website?: string;
  isPrivate?: boolean;
  location?: { type: "Point"; coordinates: [number, number] };
}

export interface LairsListResponse {
  lairs: Lair[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Decks ----

export interface Deck {
  id: string;
  playerId?: string;
  gameId?: string;
  name: string;
  url?: string;
  description?: string;
  decklist?: string;
  visibility?: "private" | "public";
  creatorName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DecksListResponse {
  decks: Deck[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Export hors ligne ----

/** Réponse de GET /games/{slug}/exports : pointeur vers le document complet. */
export interface GameExportInfo {
  url: string;
  /** Taille du document en octets. */
  size: number;
  generatedAt: string;
}

/** Entrée brute d'un document de règles dans l'export ({id, content}). */
export interface RawRuleEntry {
  id: string;
  content: string;
}

/** Document d'export complet d'un jeu (téléchargé depuis `GameExportInfo.url`). */
export interface GameExport {
  game: { id?: string; slug?: string; name?: string };
  generatedAt: string;
  cards: Record<string, unknown>[];
  erratas: Errata[];
  policies?: Policy[];
  rules: {
    en?: { cr?: RawRuleEntry[]; tr?: RawRuleEntry[] };
    fr?: { cr?: RawRuleEntry[]; tr?: RawRuleEntry[] };
  };
}

/** Métadonnées locales d'un export téléchargé. */
export interface OfflineMeta {
  slug: string;
  name: string;
  /** Taille du document en octets. */
  size: number;
  /** Date de génération côté serveur. */
  generatedAt: string;
  /** Date de téléchargement local. */
  downloadedAt: string;
}

// ---- Vérificateur de deck (Riftbound) ----

export interface DeckListCard {
  name: string;
  quantity: number;
  cardId?: string;
  image?: string;
  banned?: boolean;
  /** false si l'entrée n'a pas pu être associée à une carte connue. */
  recognized?: boolean;
  erratas?: Errata[];
}

export interface DeckList {
  champions: DeckListCard[];
  legends: DeckListCard[];
  maindeck: DeckListCard[];
  sideboard: DeckListCard[];
  battlefields: DeckListCard[];
  runes: DeckListCard[];
}

export interface DeckCheckResponse {
  deck: DeckList;
  /** Lien Piltover Archive normalisé, si disponible. */
  link?: string;
  /** Code de deck Piltover, si disponible. */
  code?: string;
}

// ---- Collection ----

export interface SetCompletion {
  setCode: string;
  masterOwned: number;
  masterTotal: number;
  gameOwned: number;
  gameTotal: number;
}

export interface GameCollectionStats {
  gameId: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  type?: string;
  copies: number;
  masterOwned: number;
  masterTotal: number;
  gameOwned: number;
  gameTotal: number;
  sets?: SetCompletion[];
}

export interface CollectionOverview {
  totalCopies: number;
  masterOwned: number;
  masterTotal: number;
  gameOwned: number;
  gameTotal: number;
  gamesWithItems: number;
  games: (GameCollectionStats | null)[];
}

/** Une carte du catalogue d'un jeu, annotée avec la quantité possédée par le propriétaire consulté. */
export interface CollectionItem {
  id: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  type?: string;
  quantity: number;
  /** Nombre d'autres éditions de cette même carte (ex. alt arts) possédées à au moins un exemplaire. */
  variantsOwned: number;
}

/** Réponse paginée de GET /collection/games/{slug} (ou son équivalent play-group). */
export interface GameCollectionResult {
  items: CollectionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  setCodes: string[];
  types: string[];
  stats: GameCollectionStats | null;
  game: { id: string; name: string; slug: string };
}

/** Payload d'ajout d'un exemplaire à une collection (POST /collection/cards). */
export interface CollectionCardInput {
  cardId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
}

/** Copie possédée d'une carte du catalogue (`GET /collection/cards/{cardId}`). */
export interface CollectionCardEntry {
  id: string;
  foil?: boolean;
  language?: "FR" | "EN" | "ZH" | "IT" | "JA" | "KO";
  condition?: "Damaged" | "Played" | "Good" | "Near Mint" | "Mint";
  grade?: number;
  obtainedAt?: string;
  acquisitionPrice?: number;
  acquisitionCurrency?: string;
  borrowedBy?: string;
  /** Présent si cette copie est déjà en vente. */
  forSale?: {
    itemId: string;
    sellListId: string;
    price?: number;
    currency?: string;
    note?: string;
  };
}

export interface OwnedCopiesResponse {
  quantity: number;
  cards: CollectionCardEntry[];
}

// ---- Listes de souhaits / listes de vente ----

/** Les deux types de propriétaire possibles pour une liste (perso ou groupe). */
export type ListOwnerType = "user" | "playGroup";
export type WishlistVisibility = "private" | "unlisted" | "public";

export interface Wishlist {
  id: string;
  name: string;
  description?: string;
  ownerType: ListOwnerType;
  ownerId: string;
  visibility: WishlistVisibility;
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  cardId: string;
  gameId?: string;
  gameName?: string;
  gameSlug?: string;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  image?: string;
  type?: string;
  quantity: number;
  note?: string;
  addedByUserId?: string;
  createdAt?: string;
  /** Uniquement sur l'endpoint de liste : quantité possédée par le viewer courant. */
  ownedQuantity?: number;
}

/** Réponse de `GET /wishlists/mine` : listes perso + listes de chaque play-group. */
export interface WishlistsMineResponse {
  personal: Wishlist[];
  groups: {
    group: { id: string; name: string };
    wishlists: Wishlist[];
  }[];
}

export interface WishlistItemsResponse {
  items: WishlistItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SellList {
  id: string;
  ownerType: ListOwnerType;
  ownerId: string;
  description?: string;
  itemsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellListItem {
  id: string;
  sellListId: string;
  collectionEntryId: string;
  cardId: string;
  gameId?: string;
  gameName?: string;
  gameSlug?: string;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  image?: string;
  type?: string;
  foil?: boolean;
  language?: string;
  condition?: string;
  grade?: number;
  price?: number;
  currency?: string;
  note?: string;
  addedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellListItemsResponse {
  items: SellListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Échanges ----

/** Impression proposable à l'échange (collection ou catalogue, tous jeux confondus). */
export interface TradeCard {
  /** Clé stable d'une impression : `name|setCode|collectorNumber`. */
  key: string;
  /** Id catalogue (`cards.id`). Absent pour de rares entrées de collection historiques. */
  cardId?: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  type?: string;
  gameId?: string;
  gameName?: string;
  gameSlug?: string;
  /** Nombre d'exemplaires de cette impression possédés par l'utilisateur. */
  owned: number;
}

export type TradeCardScope = "collection" | "catalog";

export interface TradeCardSearchResult {
  items: TradeCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Vrai quand la recherche catalogue a été ignorée faute d'un terme assez long. */
  needsQuery: boolean;
}

export interface TradeGame {
  id: string;
  name: string;
  slug?: string;
}

/** Carte figée dans une offre : le snapshot est résolu côté serveur, jamais fourni par le client. */
export interface TradeCardSnapshot {
  cardId?: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  gameId?: string;
  gameName?: string;
  quantity: number;
}

export type TradeSideId = "a" | "b";

export interface TradeSide {
  id: TradeSideId;
  /** `null` tant que la face n'est pas occupée par un compte (échange libre). */
  user: PublicUser | null;
  cards: TradeCardSnapshot[];
  validatedAt: string | null;
}

export type TradeStatus = "open" | "completed" | "cancelled";

export interface Trade {
  id: string;
  code: string;
  status: TradeStatus;
  revision: number;
  sides: TradeSide[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface TradeOwnedCardInput {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
}

export interface TradeCatalogCardInput {
  cardId: string;
  quantity: number;
}

export type TradeOfferUpdateInput =
  | { target: "mine"; cards: TradeOwnedCardInput[] }
  | { target: "counterparty"; cards: TradeCatalogCardInput[] };

/** Code d'erreur renvoyé par les opérations d'échange (voir `ApiError.body.error`). */
export type TradeError =
  | "not-found"
  | "forbidden"
  | "closed"
  | "conflict"
  | "empty"
  | "side-taken"
  | "already-participant"
  | "self-trade"
  | "insufficient-copies"
  | "unknown-cards"
  | "user-not-found";

// ---- Tournois ----

export type TournamentStatus = "draft" | "in-progress" | "completed";
export type TournamentPhaseType = "freeform" | "swiss" | "elimination" | "bracket";
export type TournamentPhaseStatus = "not-started" | "in-progress" | "completed";
export type TournamentPlayerStatus = "registered" | "pre-registered" | "dropped";
export type TournamentMatchStatus = "pending" | "in-progress" | "completed" | "disputed";
export type TournamentResultMode = "points" | "selection";
export type TournamentAnnouncementLevel = "info" | "urgent";

export interface TournamentTimer {
  durationSeconds: number;
  /** Présent uniquement pendant que le minuteur tourne. */
  endsAt?: string;
  running: boolean;
  /** Temps restant figé, présent uniquement en pause (permet la reprise). */
  remainingSeconds?: number;
}

export interface Tournament {
  id: string;
  name: string;
  eventId?: string;
  gameId?: string;
  status: TournamentStatus;
  currentPhaseId?: string;
  /** Code public à 9 caractères (A-Z0-9) : rejoindre via `/t/{joinCode}/join`. */
  joinCode?: string;
  timer?: TournamentTimer | null;
  settings: {
    allowSelfReporting: boolean;
    requireConfirmation: boolean;
    preRegistration: boolean;
    /** Numéro de la première table de la salle (les suivantes s'enchaînent). */
    firstTableNumber?: number;
  };
  /** Informations pratiques, pré-remplies depuis l'événement lié puis autonomes. */
  location?: string;
  startsAt?: string;
  /** Nombre de places. Absent = pas de limite affichée. */
  capacity?: number;
  createdAt: string;
}

export interface TournamentPlayer {
  id: string;
  tournamentId: string;
  userId?: string;
  displayName: string;
  discriminator?: string;
  seed?: number;
  /** Table fixe conservée pendant tout le tournoi, quand l'organisation en assigne une. */
  fixedTableNumber?: number;
  status: TournamentPlayerStatus;
  /**
   * Pointage à l'arrivée : instant auquel l'organisation a constaté la
   * présence physique du joueur. Indépendant de `status`, qui porte
   * l'inscription. Absent = pas encore pointé.
   */
  checkedInAt?: string;
  /** Liste de deck déclarée, saisie et vérifiée par l'organisation. */
  decklist?: TournamentDecklist;
  /**
   * Clé de synchronisation d'un joueur invité (`tpsk_...`). Absente pour un
   * joueur lié à un compte, ou lorsque le viewer n'est ni ce joueur invité ni
   * un organisateur.
   */
  syncKey?: string;
}

/** Liste de deck d'un joueur : texte libre, plus l'état de vérification arbitrale. */
export interface TournamentDecklist {
  content: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
  updatedAt: string;
}

export interface TournamentPhase {
  id: string;
  tournamentId: string;
  name: string;
  type: TournamentPhaseType;
  bestOf: number;
  resultMode: TournamentResultMode;
  /** Nombre de rondes prévues, quand l'organisation l'a annoncé. */
  plannedRounds?: number;
  /** Nombre de joueurs qualifiés à l'entrée de la phase (top cut). Absent = tous. */
  topCut?: number;
  order: number;
  status: TournamentPhaseStatus;
}

export interface TournamentDetail extends Tournament {
  phases: TournamentPhase[];
  players: TournamentPlayer[];
}

export interface TournamentRound {
  id: string;
  tournamentId: string;
  phaseId: string;
  /** Les numéros repartent à 1 à chaque phase : ils n'ordonnent pas le tournoi entier. */
  number: number;
  status: "in-progress" | "completed";
  /**
   * Classement de la phase figé à l'issue de la ronde. Absent tant que
   * l'organisation ne l'a pas validé — un classement figé et un classement en
   * direct ne se lisent pas pareil.
   */
  standings?: TournamentRoundStanding[];
  standingsValidatedAt?: string;
  completedAt?: string;
}

/** Une ligne du classement figé d'une ronde (même forme que le classement courant). */
export type TournamentRoundStanding = TournamentStanding;

export interface TournamentPhaseDetail extends TournamentPhase {
  rounds: TournamentRound[];
}

export interface TournamentMatchPlayer {
  playerId: string;
  score: number;
}

export interface TournamentGameResult {
  winnerId?: string | null;
  points?: Record<string, number>;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  phaseId: string;
  roundId: string;
  players: TournamentMatchPlayer[];
  games: TournamentGameResult[];
  winnerIds: string[];
  /** Position dans l'arbre d'élimination (phases `bracket`). */
  bracketPosition?: string;
  /** Table où se joue le match. Absent pour un BYE. */
  tableNumber?: number;
  /**
   * Prolongation accordée par l'arbitrage à cette table, en secondes, qui
   * s'ajoute au minuteur de la ronde pour ce match seul. 0 ou absent = aucune.
   */
  extensionSeconds?: number;
  status: TournamentMatchStatus;
  reportedBy?: string;
  confirmedBy?: string;
}

export interface TournamentRoundDetail extends TournamentRound {
  matches: TournamentMatch[];
}

/** Une ronde et ses matchs dans `GET /tournaments/{id}/history`. */
export interface TournamentHistoryRound {
  round: TournamentRound;
  matches: TournamentMatch[];
}

/** Une phase et ses rondes dans `GET /tournaments/{id}/history`. */
export interface TournamentHistoryPhase {
  phase: TournamentPhase;
  rounds: TournamentHistoryRound[];
}

/**
 * Historique complet du tournoi : phases ordonnées, rondes, matchs et
 * classement figé de chaque ronde. Une seule requête là où il en fallait une
 * par ronde.
 */
export interface TournamentHistory {
  phases: TournamentHistoryPhase[];
  players: TournamentPlayer[];
}

export interface TournamentStanding {
  playerId: string;
  displayName: string;
  discriminator?: string;
  userId?: string;
  playerStatus: TournamentPlayerStatus;
  wins: number;
  losses: number;
  draws: number;
  matchPoints: number;
  gamesWon: number;
  gamesLost: number;
  gamesDiff: number;
  opponentMatchWinPercentage?: number;
}

/** Réponse de `POST /tournaments/join`. */
export interface TournamentJoinResult {
  tournamentId: string;
  alreadyJoined: boolean;
  player: TournamentPlayer;
}

/** Une entrée de `GET /tournaments/playing` (compte connecté, sans clé). */
export interface TournamentPlayingEntry {
  tournament: Tournament;
  player: TournamentPlayer;
}

/** Une entrée de `POST /tournaments/sync`, pour une clé de joueur invité. */
export interface TournamentSyncEntry {
  key: string;
  tournament: { id: string; name: string; status: TournamentStatus; createdAt: string };
  player: { id: string; displayName: string; status: TournamentPlayerStatus };
}

/** Annonce publique diffusée aux joueurs via `GET /tournaments/{id}/live`. */
export interface TournamentAnnouncementPublic {
  id: string;
  message: string;
  level: TournamentAnnouncementLevel;
  createdAt: string;
}

/** État public d'un tournoi, interrogé en polling (sans auth). */
export interface TournamentLiveState {
  name: string;
  /** Panneau demandé par l'organisation pour l'écran de salle. */
  display?: "timer" | "announcements" | "standings" | "matches";
  /** Numéro de la ronde en cours, quand le panneau demandé le fait calculer. */
  roundNumber?: number | null;
  announcements: TournamentAnnouncementPublic[];
  timer: TournamentTimer | null;
  serverNow: string;
}
