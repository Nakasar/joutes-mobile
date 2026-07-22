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

export interface GameSummary {
  /** L'API renvoie `_id` sur GET /games. */
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  banner?: string;
  type?: string;
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
  registeredParticipantsCount?: number;
  maxParticipants?: number;
  lair?: { id?: string; name?: string; [key: string]: unknown };
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
  policies?: Record<string, unknown>[];
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
