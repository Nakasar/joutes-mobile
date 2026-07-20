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
  | { type: "match"; children: MarkupNode[] };

const MARKUP_TAG_REGEX =
  /\{\{rule id="([^"]*)"\}\}|\{\{\/rule\}\}|\{\{keyword id="([^"]*)"\}\}|\{\{\/keyword\}\}|\{\{match\}\}|\{\{\/match\}\}/g;

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

  return root;
}
