import {
  getKeywordIdByName,
  getKeywordNamesPatternSource,
  KEYWORD_ARROW_SUFFIX_SOURCE,
  KEYWORD_VALUE_SUFFIX_SOURCE,
} from "./riftbound-keywords";
import { replaceIconTags } from "./riftbound-icons";

// Portage de `lib/card-text-markdown.ts` (joutes-app).

let bracketKeywordRegex: RegExp | null | undefined;

function getBracketKeywordRegex(): RegExp | null {
  if (bracketKeywordRegex !== undefined) return bracketKeywordRegex;

  const namesPattern = getKeywordNamesPatternSource();
  bracketKeywordRegex = namesPattern
    ? new RegExp(
        `\\[(${namesPattern})(${KEYWORD_VALUE_SUFFIX_SOURCE})\\](${KEYWORD_ARROW_SUFFIX_SOURCE})`,
        "g",
      )
    : null;
  return bracketKeywordRegex;
}

/**
 * Réécrit le texte d'aptitude d'une carte pour que :
 * - les mots-clés entre crochets (ex. `[Accelerate]`, `[Assault 4]`) deviennent
 *   des liens `keyword://` avec la valeur conservée dans le badge ;
 * - un mot-clé suivi d'un `[>]` séparé devienne un badge en forme de flèche ;
 * - les balises glyphes `:rb_xxx:` deviennent des icônes inline ;
 * - les sauts de ligne simples deviennent de vrais sauts de paragraphe.
 */
export function annotateCardText(text: string): string {
  const idByName = getKeywordIdByName();
  const regex = getBracketKeywordRegex();

  let result = text.replace(/\n+/g, "\n\n");

  if (regex) {
    result = result.replace(
      regex,
      (full, name: string, value: string, arrowSuffix: string) => {
        const id = idByName.get(name);
        if (!id) return full;
        return `[${name}${value}](keyword://${id}${arrowSuffix ? "/arrow" : ""})`;
      },
    );
  }

  return replaceIconTags(result);
}
