import { Fragment, type ReactNode } from "react";

/**
 * Rendu markdown minimaliste pour les textes de l'API (erratas, rulings…) :
 * **gras**, *italique*, `code`, [liens](https://…) et citations `>`.
 * Construit des éléments React — aucun HTML injecté.
 */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  // Regroupe les lignes en paragraphes et blocs de citation.
  const blocks: { quote: boolean; lines: string[] }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "") {
      blocks.push({ quote: false, lines: [] });
      continue;
    }
    const quote = line.startsWith(">");
    const content = quote ? line.replace(/^>\s?/, "") : line;
    const last = blocks[blocks.length - 1];
    if (last && last.quote === quote && last.lines.length > 0) {
      last.lines.push(content);
    } else {
      blocks.push({ quote, lines: [content] });
    }
  }

  return (
    <div className="markdown">
      {blocks
        .filter((block) => block.lines.length > 0)
        .map((block, index) => {
          const content = block.lines.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ));
          return block.quote ? (
            <blockquote key={index}>{content}</blockquote>
          ) : (
            <p key={index}>{content}</p>
          );
        })}
    </div>
  );
}
