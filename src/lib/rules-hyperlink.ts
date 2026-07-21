import type { RawRuleEntry, RuleDocument, RuleEntry } from "../api/types";

/**
 * Génération des règles « hyperliées » à partir des entrées brutes
 * (`{id, content}`) de l'export, pour la lecture hors ligne. Portage de la
 * moitié « hyperlinking » de `lib/rules/riftbound.ts` (joutes-app) : produit
 * le même format que l'API (`markup` avec balises `{{rule}}` / `{{keyword}}` /
 * `{{match}}`, `isTitle`, `isKeyword`, `depth`).
 */

function isTitle(entry: RawRuleEntry): boolean {
  return /^\d{3}$/.test(entry.id) && entry.content.length <= 60;
}

// Id de l'en-tête « Keyword Glossary » du CR : chaque titre au-delà (805, …)
// est un mot-clé individuel. Ids stables entre langues.
const KEYWORD_GLOSSARY_HEADER_ID = 804;
// Quelques mots-clés d'aptitude définis hors du glossaire numéroté (ex.
// Predict / Prédiction — 436) restent traités comme mots-clés.
const EXTRA_KEYWORD_IDS = new Set(["436"]);

function isKeywordEntry(entry: RawRuleEntry, document: RuleDocument): boolean {
  if (document !== "CR" || !isTitle(entry)) return false;
  return (
    parseInt(entry.id, 10) > KEYWORD_GLOSSARY_HEADER_ID ||
    EXTRA_KEYWORD_IDS.has(entry.id)
  );
}

function getDepth(id: string): number {
  return id.split(".").length;
}

interface TitleTarget {
  id: string;
  isKeyword: boolean;
}
interface TitleData {
  map: Map<string, TitleTarget>;
  /**
   * RegExp partagée reconnaissant tous les titres, construite une seule fois
   * par document et réutilisée pour chaque entrée (on réinitialise `lastIndex`
   * à chaque usage). `null` si aucun titre.
   */
  regex: RegExp | null;
}

function buildTitleData(
  entries: RawRuleEntry[],
  document: RuleDocument,
): TitleData {
  const map = new Map<string, TitleTarget>();
  for (const entry of entries) {
    if (isTitle(entry)) {
      map.set(entry.content, {
        id: entry.id,
        isKeyword: isKeywordEntry(entry, document),
      });
    }
  }
  const sortedTitles = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = sortedTitles.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex =
    escaped.length > 0 ? new RegExp(`(${escaped.join("|")})`, "g") : null;
  return { map, regex };
}

type Token =
  | { type: "text"; text: string }
  | { type: "link"; text: string; targetId: string; isKeyword: boolean };

function tokenizeWithLinks(
  text: string,
  titleData: TitleData,
  currentId: string,
): Token[] {
  const regex = titleData.regex;
  if (!regex) return [{ type: "text", text }];
  regex.lastIndex = 0;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedTitle = match[1];
    const target = titleData.map.get(matchedTitle);
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    if (target && target.id !== currentId) {
      tokens.push({
        type: "link",
        text: matchedTitle,
        targetId: target.id,
        isKeyword: target.isKeyword,
      });
    } else {
      tokens.push({ type: "text", text: matchedTitle });
    }
    lastIndex = match.index + matchedTitle.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }
  return tokens.length > 0 ? tokens : [{ type: "text", text }];
}

function markQueryInMarkup(text: string, query: string): string {
  if (!query) return text;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(`{{match}}${match[1]}{{/match}}`);
    lastIndex = match.index + match[1].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.join("");
}

function serializeTokens(tokens: Token[], query: string | undefined): string {
  return tokens
    .map((token) => {
      const inner = query ? markQueryInMarkup(token.text, query) : token.text;
      if (token.type === "link") {
        const tag = token.isKeyword ? "keyword" : "rule";
        return `{{${tag} id="${token.targetId}"}}${inner}{{/${tag}}}`;
      }
      return inner;
    })
    .join("");
}

function buildMarkup(
  text: string,
  titleData: TitleData,
  currentId: string,
  query?: string,
): string {
  return serializeTokens(tokenizeWithLinks(text, titleData, currentId), query);
}

/** Entrées brutes d'un document → entrées hyperliées (format API `RuleEntry`). */
export function hyperlinkEntries(
  rawEntries: RawRuleEntry[],
  document: RuleDocument,
): RuleEntry[] {
  const titleData = buildTitleData(rawEntries, document);
  return rawEntries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    markup: buildMarkup(entry.content, titleData, entry.id),
    isTitle: isTitle(entry),
    isKeyword: isKeywordEntry(entry, document),
    depth: getDepth(entry.id),
    document,
  }));
}

function findSectionId(
  entryId: string,
  entriesById: Map<string, RuleEntry>,
): string {
  let currentId = entryId;
  for (;;) {
    const parts = currentId.split(".");
    if (parts.length === 1) return currentId;
    const parentId = parts.slice(0, -1).join(".");
    const parent = entriesById.get(parentId);
    if (!parent) return parentId;
    if (parent.isTitle) return parentId;
    currentId = parentId;
  }
}

/** Recherche hors ligne dans un document (entrées correspondantes + contexte). */
export function searchHyperlinkedEntries(
  rawEntries: RawRuleEntry[],
  document: RuleDocument,
  query: string,
  limit = 30,
): RuleEntry[] {
  const entries = hyperlinkEntries(rawEntries, document);
  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const titleData = buildTitleData(rawEntries, document);
  const lowerQuery = query.toLowerCase();

  const matchedIds = entries
    .filter(
      (e) => e.id.includes(query) || e.content.toLowerCase().includes(lowerQuery),
    )
    .map((e) => e.id)
    .slice(0, limit);
  if (matchedIds.length === 0) return [];

  const matchedIdSet = new Set(matchedIds);
  const sectionIds = new Set<string>();
  for (const id of matchedIds) sectionIds.add(findSectionId(id, entriesById));

  const includedIds = new Set<string>();
  for (const sectionId of sectionIds) {
    for (const entry of entries) {
      if (entry.id === sectionId || entry.id.startsWith(sectionId + ".")) {
        includedIds.add(entry.id);
      }
    }
  }

  const results: RuleEntry[] = [];
  for (const entry of entries) {
    if (!includedIds.has(entry.id)) continue;
    const matched = matchedIdSet.has(entry.id);
    results.push({
      ...entry,
      markup: matched
        ? buildMarkup(entry.content, titleData, entry.id, query)
        : entry.markup,
      sectionId: findSectionId(entry.id, entriesById),
      matched,
    });
  }
  return results;
}
