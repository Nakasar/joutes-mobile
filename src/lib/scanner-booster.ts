/* Copie de `lib/scanner-booster.ts` de joutes-app : toute modification se reporte dans les deux dépôts. */

/**
 * Choix de la carte lue par le scanner d'un booster.
 *
 * Le nom ne suffit pas toujours : dans une même extension, une carte peut
 * exister sous plusieurs numéros (illustration alternative `202a`, signée
 * `202*`, showcase hors numérotation). Le numéro de collection imprimé sur la
 * carte les départage ; s'il est illisible, on ne choisit pas à la place
 * du joueur.
 */

import Fuse from "fuse.js";

/** Rend une saisie inoffensive dans une expression régulière. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ScannedCandidate = { id: string; name: string; collectorNumber: string };

/** `007a` et `7A` désignent le même numéro : sans zéros en tête, en minuscules. */
export function normalizeCollectorNumber(collectorNumber: string): string {
  const compact = collectorNumber.trim().toLowerCase().replace(/\s+/g, "");
  return compact.replace(/^0+(?=\d)/, "");
}

/** Partie chiffrée du numéro : `202a` → `202`. */
function digitsOf(collectorNumber: string): string {
  return normalizeCollectorNumber(collectorNumber).match(/\d+/)?.[0] ?? "";
}


/**
 * Numéros de collection lus sur la carte, dans l'ordre de lecture. La lecture
 * porte sur toute la carte, où traînent coût, puissance et autres chiffres :
 * seul compte un numéro collé au code de l'extension (`OGN-202a`) ou suivi du
 * total de l'extension (`202a/298`). Le premier, plus sûr, l'emporte : un
 * compteur `12/30` dans le texte de règles ne passe alors pas pour un numéro.
 */
export function readCollectorNumbers(text: string, setCode?: string): string[] {
  // Pas de chiffre juste avant : `1307/298` ne se lit pas `307`.
  const number = "(?<![\\d/])(\\d{1,4})([a-z*](?![a-z]))?";
  const read = (pattern: string) =>
    [...text.matchAll(new RegExp(pattern, "gi"))].map((match) =>
      normalizeCollectorNumber(`${match[1]}${match[2] ?? ""}`),
    );

  const withSetCode = setCode ? read(`${escapeRegex(setCode)}\\s*[-–·.]?\\s*${number}`) : [];
  const found = withSetCode.length > 0 ? withSetCode : read(`${number}\\s*\\/\\s*\\d{2,4}`);
  return [...new Set(found)];
}

/**
 * Carte retenue parmi celles qui portent le nom lu, ou `null` quand le numéro
 * ne permet pas de trancher.
 */
export function pickScannedCard<T extends ScannedCandidate>(candidates: T[], numbers: string[]): T | null {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0 || numbers.length === 0) return null;

  for (const number of numbers) {
    const exact = candidates.filter((card) => normalizeCollectorNumber(card.collectorNumber) === number);
    if (exact.length === 1) return exact[0];
  }

  // Le suffixe (`a`, `*`) se perd souvent à la lecture : le chiffre seul ne
  // tranche que s'il n'appartient qu'à une carte.
  for (const number of numbers) {
    const digits = digitsOf(number);
    const sameDigits = candidates.filter((card) => digitsOf(card.collectorNumber) === digits);
    if (sameDigits.length === 1) return sameDigits[0];
  }

  return null;
}

// Plus strict que le scanner des outils de jeu : la carte entière est lue, et
// une ligne de texte de règles ne doit pas passer pour un nom.
const NAME_MATCH_THRESHOLD = 0.3;
// Un bout de ligne trop court trouve toujours un nom qui le contient.
const MIN_QUERY_TO_NAME_RATIO = 0.6;
const MIN_QUERY_LENGTH = 3;

/**
 * Reconnaît un nom de carte dans le texte lu sur toute la carte, ligne par
 * ligne. Deux lignes qui se suivent sont aussi essayées ensemble : un nom long
 * (« Jinx, Loose Cannon ») est souvent imprimé sur deux lignes.
 */
export function createNameMatcher(names: string[]) {
  const fuse = new Fuse(names, { includeScore: true, threshold: NAME_MATCH_THRESHOLD, ignoreLocation: true });

  return (text: string): { name: string; score: number } | null => {
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/[^\p{L}\p{N}',\- ]/gu, " ").replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= MIN_QUERY_LENGTH);
    const queries = [...lines, ...lines.slice(1).map((line, i) => `${lines[i]} ${line}`)];

    let best: { name: string; score: number } | null = null;
    for (const query of queries) {
      for (const hit of fuse.search(query, { limit: 3 })) {
        if (hit.score === undefined || query.length < hit.item.length * MIN_QUERY_TO_NAME_RATIO) continue;
        if (!best || hit.score < best.score) best = { name: hit.item, score: hit.score };
        break;
      }
    }
    return best;
  };
}
