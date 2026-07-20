import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getRules, searchRules } from "../api/rules";
import type { RuleDocument, RuleEntry, RuleLang } from "../api/types";
import { BackHeader } from "../components/BackHeader";
import { KeywordBadge } from "../components/KeywordBadge";
import { RuleMarkup } from "../components/RuleMarkup";
import { StatusView } from "../components/StatusView";
import { useApi } from "../hooks/useApi";
import {
  buildRuleTree,
  getRuleSections,
  type RuleSection,
  type RuleTreeNode,
} from "../lib/rules-tree";

function isDocument(value: string | null): value is RuleDocument {
  return value === "CR" || value === "TR";
}
function isLang(value: string | null): value is RuleLang {
  return value === "en" || value === "fr";
}

/** Défile en douceur vers une entrée de règle par son id. */
function scrollToRule(ruleId: string) {
  const el = document.getElementById(`rule-${ruleId}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function RuleNode({
  node,
  collapsedIds,
  onToggle,
  onNavigate,
  searchActive,
  resultsById,
  framedSectionIds,
}: {
  node: RuleTreeNode;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
  searchActive: boolean;
  resultsById: Map<string, RuleEntry>;
  framedSectionIds: Set<string>;
}) {
  const markup = searchActive
    ? resultsById.get(node.id)?.markup ?? node.markup
    : node.markup;
  const isOpen = !collapsedIds.has(node.id);
  const indentClass = `rule-node rule-node--d${Math.min(node.depth, 6)}`;

  if (node.isTitle && node.depth === 1) {
    const isFramed = searchActive && framedSectionIds.has(node.id);
    const isDimmed = searchActive && !framedSectionIds.has(node.id);
    return (
      <div
        id={`rule-${node.id}`}
        className={`rule-section-title${isFramed ? " rule-section-title--framed" : ""}${
          isDimmed ? " rule-section-title--dimmed" : ""
        }`}
      >
        <h2>
          <button
            className="rule-toggle"
            onClick={() => onToggle(node.id)}
            aria-label={isOpen ? "Replier" : "Déplier"}
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <span className="rule-id">{node.id}.</span>
          {node.isKeyword ? (
            <KeywordBadge id={node.id} size="heading">
              <RuleMarkup
                markup={markup}
                keyPrefix={`title-${node.id}`}
                onNavigate={onNavigate}
              />
            </KeywordBadge>
          ) : (
            <span>
              <RuleMarkup
                markup={markup}
                keyPrefix={`title-${node.id}`}
                onNavigate={onNavigate}
              />
            </span>
          )}
        </h2>
        {isOpen && node.children.length > 0 && (
          <div className="rule-children">
            {node.children.map((child) => (
              <RuleNode
                key={child.id}
                node={child}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                onNavigate={onNavigate}
                searchActive={searchActive}
                resultsById={resultsById}
                framedSectionIds={framedSectionIds}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id={`rule-${node.id}`} className={indentClass}>
      <div className="rule-row">
        <span className="rule-id rule-id--mono">{node.id}</span>
        <p className={node.depth === 1 ? "rule-text rule-text--strong" : "rule-text"}>
          <RuleMarkup
            markup={markup}
            keyPrefix={`rule-${node.id}`}
            onNavigate={onNavigate}
          />
        </p>
      </div>
      {node.children.length > 0 && (
        <div className="rule-children">
          {node.children.map((child) => (
            <RuleNode
              key={child.id}
              node={child}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onNavigate={onNavigate}
              searchActive={searchActive}
              resultsById={resultsById}
              framedSectionIds={framedSectionIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableOfContents({
  sections,
  onNavigate,
}: {
  sections: RuleSection[];
  onNavigate: (anchorId: string) => void;
}) {
  return (
    <nav className="rules-toc">
      <p className="rules-toc__heading">Sommaire</p>
      {sections.map((sec) => (
        <a
          key={sec.start}
          className="rules-toc__item"
          href={`#${sec.anchorId}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(sec.anchorId);
          }}
        >
          {sec.start > 0 ? `${sec.start}– ` : ""}
          {sec.label}
        </a>
      ))}
    </nav>
  );
}

export function RulesScreen() {
  const { gameSlug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const documentParam = searchParams.get("doc");
  const langParam = searchParams.get("lang");
  const ruleParam = searchParams.get("rule");
  const ruleDocument: RuleDocument = isDocument(documentParam)
    ? documentParam
    : "CR";
  const lang: RuleLang = isLang(langParam) ? langParam : "fr";

  const { data, loading, error, reload } = useApi(
    () => getRules(gameSlug, { document: ruleDocument, lang }),
    [gameSlug, ruleDocument, lang],
  );

  const sections = useMemo<RuleSection[]>(() => {
    if (!data) return [];
    return getRuleSections(buildRuleTree(data));
  }, [data]);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [tocOpen, setTocOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RuleEntry[] | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const navigateToRule = useCallback((ruleId: string) => {
    // Déplie la section racine si besoin avant de défiler.
    const rootId = ruleId.split(".")[0];
    setCollapsedIds((prev) => {
      if (!prev.has(rootId)) return prev;
      const next = new Set(prev);
      next.delete(rootId);
      return next;
    });
    requestAnimationFrame(() => scrollToRule(ruleId));
  }, []);

  const navigateToAnchor = useCallback(
    (anchorId: string) => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTocOpen(false);
    },
    [],
  );

  // Recherche serveur : entrées correspondantes + leur contexte.
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults(null);
      return;
    }
    const id = ++requestId.current;
    searchRules(gameSlug, {
      document: ruleDocument,
      lang,
      query: debouncedQuery,
    })
      .then((results) => {
        if (id !== requestId.current) return;
        setSearchResults(results);
        const sectionIds = new Set(results.map((r) => r.sectionId));
        if (sectionIds.size > 0) {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            sectionIds.forEach((sid) => sid && next.delete(sid));
            return next;
          });
        }
        const firstMatchId = results.find((r) => r.matched)?.id;
        if (firstMatchId) {
          requestAnimationFrame(() => scrollToRule(firstMatchId));
        }
      })
      .catch(() => {
        if (id === requestId.current) setSearchResults([]);
      });
  }, [debouncedQuery, gameSlug, ruleDocument, lang]);

  // Défile vers la règle ciblée (?rule=…) une fois les données chargées.
  useEffect(() => {
    if (ruleParam && data) {
      navigateToRule(ruleParam);
    }
    // Une seule fois par cible / par jeu de données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleParam, data]);

  const searchActive = searchResults !== null;
  const resultsById = useMemo(
    () => new Map((searchResults ?? []).map((r) => [r.id, r])),
    [searchResults],
  );
  const framedSectionIds = useMemo(
    () => new Set((searchResults ?? []).map((r) => r.sectionId).filter(Boolean) as string[]),
    [searchResults],
  );
  const totalMatches = useMemo(
    () => (searchResults ?? []).filter((r) => r.matched).length,
    [searchResults],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("rule");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="screen rules-screen">
      <BackHeader title="Règles" />

      <div className="rules-controls">
        <div className="rules-controls__row">
          <div className="segmented">
            <button
              className={ruleDocument === "CR" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setParam("doc", "CR")}
            >
              Règles complètes
            </button>
            <button
              className={ruleDocument === "TR" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setParam("doc", "TR")}
            >
              Tournoi
            </button>
          </div>
          <div className="segmented">
            <button
              className={lang === "fr" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setParam("lang", "fr")}
              aria-label="Afficher les règles en français"
              aria-pressed={lang === "fr"}
              title="Français"
            >
              🇫🇷
            </button>
            <button
              className={lang === "en" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setParam("lang", "en")}
              aria-label="Afficher les règles en anglais"
              aria-pressed={lang === "en"}
              title="English"
            >
              🇬🇧
            </button>
          </div>
        </div>
        <div className="rules-controls__row">
          <input
            type="search"
            placeholder="Rechercher dans les règles…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            className="rules-search"
          />
          <button
            className="button-ghost rules-toc-toggle"
            onClick={() => setTocOpen((v) => !v)}
          >
            {tocOpen ? "Fermer" : "Sommaire"}
          </button>
        </div>
      </div>

      {tocOpen && sections.length > 0 && (
        <div className="rules-toc-panel">
          <TableOfContents sections={sections} onNavigate={navigateToAnchor} />
        </div>
      )}

      {debouncedQuery && searchActive && (
        <p className="muted rules-results">
          {totalMatches} résultat{totalMatches > 1 ? "s" : ""} pour «{" "}
          {debouncedQuery} »
        </p>
      )}

      <StatusView loading={loading} error={error} onRetry={reload} />

      <div className="rules-content">
        {sections.map((sec) => (
          <div key={sec.start} className="rules-section">
            {sec.nodes.map((node) => (
              <RuleNode
                key={node.id}
                node={node}
                collapsedIds={collapsedIds}
                onToggle={toggleCollapsed}
                onNavigate={navigateToRule}
                searchActive={searchActive}
                resultsById={resultsById}
                framedSectionIds={framedSectionIds}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
