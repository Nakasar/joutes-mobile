import { Fragment, type ReactNode } from "react";
import { parseRuleMarkup, type MarkupNode } from "../lib/rules-markup";
import { KeywordBadge } from "./KeywordBadge";

/**
 * Rend le markup d'une règle (pseudo-balises {{rule}}/{{keyword}}/{{match}})
 * en éléments React. Les liens de règle et badges de mots-clés déclenchent
 * `onNavigate(ruleId)` (défilement vers l'entrée cible dans le document).
 * Portage de `RuleMarkup`/`renderMarkupNodes` (RuleDocumentViewer côté web).
 */
function renderNodes(
  nodes: MarkupNode[],
  keyPrefix: string,
  onNavigate: (ruleId: string) => void,
): ReactNode {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.type === "text") return <Fragment key={key}>{node.text}</Fragment>;
    if (node.type === "rule") {
      return (
        <a
          key={key}
          className="rule-link"
          href={`#rule-${node.id}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(node.id);
          }}
        >
          {renderNodes(node.children, key, onNavigate)}
        </a>
      );
    }
    if (node.type === "keyword") {
      return (
        <KeywordBadge key={key} id={node.id} onClick={() => onNavigate(node.id)}>
          {renderNodes(node.children, key, onNavigate)}
        </KeywordBadge>
      );
    }
    return (
      <mark key={key} className="rule-match">
        {renderNodes(node.children, key, onNavigate)}
      </mark>
    );
  });
}

export function RuleMarkup({
  markup,
  keyPrefix,
  onNavigate,
}: {
  markup: string;
  keyPrefix: string;
  onNavigate: (ruleId: string) => void;
}) {
  return <>{renderNodes(parseRuleMarkup(markup), keyPrefix, onNavigate)}</>;
}
