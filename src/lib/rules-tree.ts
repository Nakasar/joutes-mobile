import type { RuleEntry } from "../api/types";

/**
 * Construction de l'arbre et des sections d'un document de règles à partir de
 * la liste plate renvoyée par l'API. Portage de `buildRuleTree` /
 * `getRuleSections` (lib/rules/riftbound.ts côté joutes-app).
 */

export interface RuleTreeNode extends RuleEntry {
  children: RuleTreeNode[];
}

export interface RuleSection {
  label: string;
  start: number;
  anchorId: string;
  nodes: RuleTreeNode[];
}

export function buildRuleTree(entries: RuleEntry[]): RuleTreeNode[] {
  const nodeMap = new Map<string, RuleTreeNode>();
  const roots: RuleTreeNode[] = [];

  for (const entry of entries) {
    const node: RuleTreeNode = { ...entry, children: [] };
    nodeMap.set(entry.id, node);

    const parts = entry.id.split(".");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentId = parts.slice(0, -1).join(".");
      const parent = nodeMap.get(parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

export function getRuleSections(roots: RuleTreeNode[]): RuleSection[] {
  const sections = new Map<number, RuleSection>();

  for (const node of roots) {
    const num = parseInt(node.id);
    const hundred = Math.floor(num / 100) * 100;
    if (!sections.has(hundred)) {
      sections.set(hundred, { label: "", start: hundred, anchorId: "", nodes: [] });
    }
    sections.get(hundred)!.nodes.push(node);
  }

  for (const [hundred, sec] of sections) {
    const exactTitle = sec.nodes.find(
      (n) => parseInt(n.id) === hundred && n.isTitle,
    );
    const firstTitle = sec.nodes.find((n) => n.isTitle);
    const titleNode = exactTitle || firstTitle || sec.nodes[0];
    sec.label = titleNode.content;
    sec.anchorId = `rule-${titleNode.id.padStart(3, "0")}`;
  }

  return [...sections.values()].sort((a, b) => a.start - b.start);
}
