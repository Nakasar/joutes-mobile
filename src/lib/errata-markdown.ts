import {
  getKeywordIdByName,
  getKeywordNamesPatternSource,
  KEYWORD_ARROW_SUFFIX_SOURCE,
  KEYWORD_VALUE_SUFFIX_SOURCE,
} from "./riftbound-keywords";
import { replaceIconTags } from "./riftbound-icons";

// Portage de `lib/errata-markdown.ts` (joutes-app). Réécrit le markdown libre
// (erratas, rulings, news…) pour styliser mots-clés, icônes et noms de cartes.

// Soit « NomDeMotClé » avec valeur associée et marqueur de forme flèche
// optionnels (groupes `kw`/`val`/`arrow`, ex. « [Predict 2] »,
// « [Equip [1]:rb_rune_body:] », « [Level 3][>] »), soit toute autre mention
// entre crochets qui n'est pas déjà un lien markdown (groupe `mention`),
// traitée comme une simple référence de nom de carte, ex. « [Leblanc, Deceiver] ».
let combinedBracketRegex: RegExp | undefined;

function getCombinedBracketRegex(): RegExp {
  if (combinedBracketRegex !== undefined) return combinedBracketRegex;

  const namesPattern = getKeywordNamesPatternSource();
  const keywordAlt = namesPattern
    ? `\\[(?<kw>${namesPattern})(?<val>${KEYWORD_VALUE_SUFFIX_SOURCE})\\](?<arrow>${KEYWORD_ARROW_SUFFIX_SOURCE})|`
    : "";

  combinedBracketRegex = new RegExp(
    `${keywordAlt}\\[(?<mention>[^[\\]]+)\\](?!\\()`,
    "g",
  );
  return combinedBracketRegex;
}

let plainKeywordRegex: RegExp | null | undefined;

function getPlainKeywordRegex(): RegExp | null {
  if (plainKeywordRegex !== undefined) return plainKeywordRegex;

  const namesPattern = getKeywordNamesPatternSource();
  // Les mentions nues hors crochets ne portent jamais de valeur — uniquement le
  // nom du mot-clé, ex. « Deathknell » cité en prose.
  plainKeywordRegex = namesPattern ? new RegExp(`(${namesPattern})`, "g") : null;
  return plainKeywordRegex;
}

/** Chaque mention entre crochets, ex. ["Leblanc, Deceiver"] pour « …vs [Leblanc, Deceiver]… ». */
export function extractBracketedMentions(text: string): string[] {
  const names = new Set<string>();
  const regex = /\[([^[\]]+)\](?!\()/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    names.add(match[1].trim());
  }

  return [...names];
}

/**
 * Réécrit le markdown d'errata pour que :
 * - une mention entre crochets qui est un nom de mot-clé, éventuellement suivie
 *   d'une valeur associée (ex. `[Deathknell]`, `[Predict 2]`) devienne
 *   `[Deathknell](keyword://808)` — la valeur restant dans le badge ;
 * - un mot-clé suivi d'un crochet `[>]` séparé (ex. `[Level 3][>]`) devienne un
 *   badge unique en forme de flèche ;
 * - toute autre mention entre crochets (ex. `[Leblanc, Deceiver]`) soit traitée
 *   comme une référence de carte : un nom de carte reconnu devient
 *   `[Leblanc, Deceiver](card://<id>)`, sinon laissé en texte brut ;
 * - les mots-clés (Deathknell, Accelerate…) trouvés ailleurs deviennent aussi
 *   des liens `keyword://` ;
 * - les balises glyphes `:rb_xxx:` et raccourcis d'icônes ([A], [1], [M]…)
 *   deviennent des images inline.
 */
export function annotateErrataMarkdown(
  text: string,
  cardIdByName: Map<string, string>,
): string {
  const idByName = getKeywordIdByName();

  const applyPlainKeywords = (segment: string): string => {
    const regex = getPlainKeywordRegex();
    if (!regex) return segment;
    return segment.replace(regex, (matched) => {
      const id = idByName.get(matched);
      return id ? `[${matched}](keyword://${id})` : matched;
    });
  };

  const regex = getCombinedBracketRegex();
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  regex.lastIndex = 0;
  while ((match = regex.exec(text)) !== null) {
    result += applyPlainKeywords(text.slice(lastIndex, match.index));

    if (match.groups?.kw) {
      const name = match.groups.kw;
      const value = match.groups.val ?? "";
      const isArrow = !!match.groups.arrow;
      const keywordId = idByName.get(name);
      result += keywordId
        ? `[${name}${value}](keyword://${keywordId}${isArrow ? "/arrow" : ""})`
        : match[0];
    } else {
      const name = (match.groups?.mention ?? "").trim();
      const cardId = cardIdByName.get(name.toLowerCase());
      // Les crochets non résolus et non mots-clés restent du texte brut plutôt
      // que de retomber sur un style de mot-clé (le crochet fait partie d'un
      // nom, ex. « Deathknell Bringer », pas d'une mention de mot-clé).
      result += cardId ? `[${name}](card://${cardId})` : match[0];
    }

    lastIndex = match.index + match[0].length;
  }
  result += applyPlainKeywords(text.slice(lastIndex));

  return replaceIconTags(result);
}
