/**
 * Parseur du petit format de pseudo-balises renvoyé par l'API des règles
 * (`/games/{slug}/rules`) — ce n'est pas du HTML :
 *   {{rule id="107"}}Combat{{/rule}}        → lien vers une section
 *   {{keyword id="826"}}Backline{{/keyword}} → mention du glossaire de mots-clés
 *   {{match}}texte{{/match}}                 → surlignage d'un résultat de recherche
 * On le parse ici pour que le front maîtrise entièrement le style, sans jamais
 * injecter de HTML fourni par le serveur. (Portage de RuleDocumentViewer.)
 */
export type MarkupNode =
  | { type: "text"; text: string }
  | { type: "rule"; id: string; children: MarkupNode[] }
  | { type: "keyword"; id: string; children: MarkupNode[] }
  | { type: "match"; children: MarkupNode[] }
  | { type: "bold"; children: MarkupNode[] }
  | { type: "italic"; children: MarkupNode[] }
  | { type: "code"; text: string };

const MARKUP_TAG_REGEX =
  /\{\{rule id="([^"]*)"\}\}|\{\{\/rule\}\}|\{\{keyword id="([^"]*)"\}\}|\{\{\/keyword\}\}|\{\{match\}\}|\{\{\/match\}\}/g;

/**
 * Parseur Markdown minimal (gras/italique/code en ligne) pour le texte brut
 * des règles. On ne gère que ces trois marqueurs (pas de titres/listes) :
 * les entrées de règles sont des paragraphes courts, pas des documents.
 */
function parseInlineMarkdown(text: string): MarkupNode[] {
  const nodes: MarkupNode[] = [];
  let i = 0;
  let textStart = 0;

  const flushText = (end: number) => {
    if (end > textStart) nodes.push({ type: "text", text: text.slice(textStart, end) });
  };

  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === "**" || two === "__") {
      const closeIdx = text.indexOf(two, i + 2);
      if (closeIdx > i + 2) {
        flushText(i);
        nodes.push({ type: "bold", children: parseInlineMarkdown(text.slice(i + 2, closeIdx)) });
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }

    const one = text[i];
    if (one === "*" || one === "_") {
      const closeIdx = text.indexOf(one, i + 1);
      if (closeIdx > i + 1) {
        flushText(i);
        nodes.push({ type: "italic", children: parseInlineMarkdown(text.slice(i + 1, closeIdx)) });
        i = closeIdx + 1;
        textStart = i;
        continue;
      }
    }

    if (one === "`") {
      const closeIdx = text.indexOf("`", i + 1);
      if (closeIdx > i + 1) {
        flushText(i);
        nodes.push({ type: "code", text: text.slice(i + 1, closeIdx) });
        i = closeIdx + 1;
        textStart = i;
        continue;
      }
    }

    i += 1;
  }
  flushText(text.length);
  return nodes;
}

/** Applique `parseInlineMarkdown` à toutes les feuilles de texte de l'arbre. */
function expandMarkdown(nodes: MarkupNode[]): MarkupNode[] {
  const result: MarkupNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      result.push(...parseInlineMarkdown(node.text));
    } else if (node.type === "code") {
      result.push(node);
    } else {
      result.push({ ...node, children: expandMarkdown(node.children) });
    }
  }
  return result;
}

export function parseRuleMarkup(markup: string): MarkupNode[] {
  const root: MarkupNode[] = [];
  const stack: { children: MarkupNode[] }[] = [{ children: root }];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    if (!raw) return;
    stack[stack.length - 1].children.push({ type: "text", text: raw });
  };

  MARKUP_TAG_REGEX.lastIndex = 0;
  while ((match = MARKUP_TAG_REGEX.exec(markup)) !== null) {
    pushText(markup.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("{{rule")) {
      const node: MarkupNode = { type: "rule", id: match[1], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (token.startsWith("{{keyword")) {
      const node: MarkupNode = { type: "keyword", id: match[2], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (token === "{{match}}") {
      const node: MarkupNode = { type: "match", children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (stack.length > 1) {
      // {{/rule}}, {{/keyword}} ou {{/match}}
      stack.pop();
    }

    lastIndex = match.index + token.length;
  }
  pushText(markup.slice(lastIndex));

  return expandMarkdown(root);
}
