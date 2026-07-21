import type {
  Card,
  CardDetail,
  CardsSearchResponse,
  Errata,
  GameExport,
  RuleDocument,
  RuleEntry,
  RuleLang,
} from "../api/types";
import { hyperlinkEntries, searchHyperlinkedEntries } from "./rules-hyperlink";

/**
 * Transforme les données du document d'export en réponses au format de l'API,
 * pour servir les écrans (règles, galerie, détail carte) en mode hors ligne.
 */

interface Indices {
  cardsById: Map<string, Card>;
  nameToId: Map<string, string>;
  /** cardId → erratas associés (via `cardIds` + mentions dans le texte). */
  erratasByCardId: Map<string, Errata[]>;
}

const indexCache = new WeakMap<GameExport, Indices>();

function firstFace(raw: Record<string, unknown>): Record<string, unknown> {
  const face = raw.face as { front?: Record<string, unknown> } | undefined;
  return face?.front ?? {};
}

/** Mappe une carte de l'export vers la forme `Card` attendue par les écrans. */
function toCard(raw: Record<string, unknown>): Card {
  const front = firstFace(raw);
  const pick = <T>(key: string): T | undefined =>
    (raw[key] as T | undefined) ?? (front[key] as T | undefined);
  // On repart des champs bruts (Domain, Set, _legal…), puis on normalise ceux
  // dont les écrans dépendent (certains vivant dans `face.front`).
  return {
    ...raw,
    id: String(raw.id),
    name: String(raw.name ?? front.name ?? ""),
    subtitle: pick<string>("subtitle"),
    type: pick<string>("type"),
    cost: pick<number>("cost"),
    image: pick<string>("image"),
    setCode: pick<string>("setCode"),
    collectorNumber: pick<string>("collectorNumber"),
    text: pick<string>("text"),
    banned: (raw.banned as boolean | undefined) ?? false,
    isToken: raw.isToken as boolean | undefined,
  } as Card;
}

/** Noms de cartes mentionnés dans un errata via `<<Nom>>` ou `[Nom]`. */
function mentionsOf(errata: Errata): string[] {
  const text = [
    errata.details,
    ...(errata.translations ?? []).map((t) => t.details),
  ].join("\n");
  const names: string[] = [];
  for (const m of text.matchAll(/<<([^<>]+)>>/g)) names.push(m[1].trim());
  for (const m of text.matchAll(/\[([^\][]+)\]/g)) names.push(m[1].trim());
  return names;
}

function buildIndices(exp: GameExport): Indices {
  const cached = indexCache.get(exp);
  if (cached) return cached;

  const cardsById = new Map<string, Card>();
  const nameToId = new Map<string, string>();
  for (const raw of exp.cards ?? []) {
    const card = toCard(raw);
    cardsById.set(card.id, card);
    if (card.name) nameToId.set(card.name.toLowerCase(), card.id);
  }

  // Liaison errata → carte : ids explicites (`cardIds`) + mentions dans le
  // texte (`<<Nom>>` / `[Nom]`) résolues contre les noms de cartes. Les
  // `cardIds` restent la source privilégiée ; les mentions comblent l'absence
  // de liaison explicite dans l'export.
  const erratasByCardId = new Map<string, Errata[]>();
  const add = (cardId: string, errata: Errata) => {
    const list = erratasByCardId.get(cardId);
    if (list) {
      if (!list.includes(errata)) list.push(errata);
    } else {
      erratasByCardId.set(cardId, [errata]);
    }
  };
  for (const errata of exp.erratas ?? []) {
    for (const id of errata.cardIds ?? []) {
      if (cardsById.has(id)) add(id, errata);
    }
    for (const name of mentionsOf(errata)) {
      const id = nameToId.get(name.toLowerCase());
      if (id) add(id, errata);
    }
  }

  const indices: Indices = { cardsById, nameToId, erratasByCardId };
  indexCache.set(exp, indices);
  return indices;
}

// ---- Règles ----

function rawRules(exp: GameExport, document: RuleDocument, lang: RuleLang) {
  const byLang = lang === "fr" ? exp.rules?.fr : exp.rules?.en;
  return (document === "TR" ? byLang?.tr : byLang?.cr) ?? [];
}

export function offlineRules(
  exp: GameExport,
  document: RuleDocument,
  lang: RuleLang,
): RuleEntry[] {
  return hyperlinkEntries(rawRules(exp, document, lang), document);
}

export function offlineSearchRules(
  exp: GameExport,
  document: RuleDocument,
  lang: RuleLang,
  query: string,
): RuleEntry[] {
  return searchHyperlinkedEntries(rawRules(exp, document, lang), document, query);
}

// ---- Cartes ----

export interface OfflineSearchCardsParams {
  searchQuery?: string;
  setCode?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export function offlineSearchCards(
  exp: GameExport,
  params: OfflineSearchCardsParams,
): CardsSearchResponse {
  const { cardsById } = buildIndices(exp);
  const all = [...cardsById.values()];
  const q = params.searchQuery?.trim().toLowerCase();

  const filtered = all.filter((c) => {
    if (params.setCode && c.setCode !== params.setCode) return false;
    if (params.type && c.type !== params.type) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const setCodes = [
    ...new Set(all.map((c) => c.setCode).filter(Boolean) as string[]),
  ].sort();
  const types = [
    ...new Set(all.map((c) => c.type).filter(Boolean) as string[]),
  ].sort();

  const limit = params.limit ?? 30;
  const page = params.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const start = (page - 1) * limit;

  return {
    cards: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    totalPages,
    setCodes,
    types,
  };
}

// ---- Détail carte ----

export function offlineGetCard(
  exp: GameExport,
  cardId: string,
): CardDetail | null {
  const { cardsById, nameToId, erratasByCardId } = buildIndices(exp);
  const card = cardsById.get(cardId);
  if (!card) return null;

  const erratas = erratasByCardId.get(cardId) ?? [];
  // `cardIdByName` permet aux mentions `[Carte]` dans les erratas de devenir
  // des liens ; on fournit l'index global nom → id.
  const cardIdByName: Record<string, string> = {};
  for (const [name, id] of nameToId) cardIdByName[name] = id;

  return {
    ...card,
    game: { id: exp.game?.id, name: exp.game?.name, slug: exp.game?.slug },
    erratas,
    cardIdByName,
  };
}
