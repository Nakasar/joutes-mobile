/**
 * Données de mots-clés (keywords) Riftbound embarquées dans l'app.
 *
 * Côté web (joutes-app), la liste est dérivée à la volée des fichiers de
 * règles (`data/riftbound/cr.json`) via `getAllKeywordEntries()`. L'app mobile
 * n'embarque pas le corpus complet des règles : on fige donc ici la petite
 * liste des mots-clés du glossaire (id stable + nom EN/FR), extraite du même
 * corpus le 2026-07-20. Elle sert à repérer et styliser les mentions de
 * mots-clés dans des textes libres (erratas, news, texte de carte) quelle que
 * soit la langue de rédaction.
 *
 * Les couleurs reprennent le code couleur officiel des mots-clés, identique à
 * `components/games/KeywordBadge.tsx` côté web.
 */

export interface KeywordEntry {
  id: string;
  /** Noms connus du mot-clé (EN puis FR), tels qu'ils apparaissent en texte. */
  names: string[];
}

/** Glossaire des mots-clés Riftbound (id → noms EN/FR). */
export const KEYWORD_ENTRIES: KeywordEntry[] = [
  { id: "436", names: ["Predict", "Prédiction"] },
  { id: "805", names: ["Accelerate", "Accélération"] },
  { id: "806", names: ["Action", "Action"] },
  { id: "807", names: ["Assault", "Assaut"] },
  { id: "808", names: ["Deathknell", "Agonie"] },
  { id: "809", names: ["Deflect", "Protection"] },
  { id: "810", names: ["Ganking", "Gank"] },
  { id: "811", names: ["Hidden", "Caché"] },
  { id: "812", names: ["Legion", "Légion"] },
  { id: "813", names: ["Reaction", "Réaction"] },
  { id: "814", names: ["Shield", "Bouclier"] },
  { id: "815", names: ["Tank", "Tank"] },
  { id: "816", names: ["Temporary", "Temporaire"] },
  { id: "817", names: ["Vision", "Vision"] },
  { id: "818", names: ["Equip", "Équiper"] },
  { id: "819", names: ["Quick-Draw", "Dégainer"] },
  { id: "820", names: ["Repeat", "Répétition"] },
  { id: "821", names: ["Weaponmaster", "Expert en armes"] },
  { id: "822", names: ["Ambush", "Embuscade"] },
  { id: "823", names: ["Hunt", "Chasse"] },
  { id: "824", names: ["Level", "Niveau"] },
  { id: "825", names: ["Unique", "Unique"] },
  { id: "826", names: ["Backline", "Arrière-ligne"] },
];

// Couleurs officielles par id de mot-clé (voir KeywordBadge côté web).
export const KEYWORD_COLORS: Record<string, string> = {
  "805": "#226B5C", // Accelerate
  "806": "#226B5C", // Action
  "807": "#C22D6A", // Assault
  "808": "#8EAD2A", // Deathknell
  "809": "#8EAD2A", // Deflect
  "810": "#8EAD2A", // Ganking
  "811": "#226B5C", // Hidden
  "812": "#226B5C", // Legion
  "813": "#226B5C", // Reaction
  "814": "#C22D6A", // Shield
  "815": "#C22D6A", // Tank
  "816": "#8EAD2A", // Temporary
  "817": "#6D6C6D", // Vision
  "818": "#226B5C", // Equip
  "819": "#226B5C", // Quick-Draw
  "820": "#226B5C", // Repeat
  "821": "#6D6C6D", // Weaponmaster
  "822": "#226B5C", // Ambush
  "823": "#8EAD2A", // Hunt
  "824": "#8EAD2A", // Level
  "825": "#6D6C6D", // Unique
  "826": "#C22D6A", // Backline
  "436": "#6D6C6D", // Predict
};

// Une mention de mot-clé peut être suivie d'une valeur associée après son nom,
// ex. « [Predict 2] », « [Assault 2] », « [Equip [1]:rb_rune_body:] » — mais
// pas d'un autre mot en toutes lettres, qui indiquerait plutôt un nom de carte
// (ex. « [Deathknell Bringer] »). La valeur peut contenir un niveau de
// raccourci d'icône entre crochets (`[1]`, `[M]`, …) en plus des chiffres, des
// espaces et des balises `:rb_xxx:`.
export const KEYWORD_VALUE_SUFFIX_SOURCE = String.raw`(?:[\s\d]|:[a-z0-9_]+:|\[[^\]]*\])*`;

// Certains mots-clés (ex. Niveau) sont suivis d'un crochet « [>] » séparé qui
// les marque comme badge « pointé » (flèche vers la droite au lieu de la forme
// biseautée habituelle), ex. « [Level 3][>] ». Les données sources portent
// parfois l'entité HTML « [&gt;] » à la place du « [>] » littéral : les deux
// sont acceptées. C'est un marqueur de forme, pas du texte visible : il est
// capturé à part et retiré du libellé.
export const KEYWORD_ARROW_SUFFIX_SOURCE = String.raw`(?:\s*\[(?:>|&gt;)\])?`;

let cache: { idByName: Map<string, string>; namesPattern: string | null } | null =
  null;

function getCache() {
  if (cache) return cache;

  const idByName = new Map<string, string>();
  for (const entry of KEYWORD_ENTRIES) {
    for (const name of entry.names) idByName.set(name, entry.id);
  }

  const sortedNames = [...idByName.keys()].sort((a, b) => b.length - a.length);
  const escaped = sortedNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  cache = {
    idByName,
    namesPattern: escaped.length > 0 ? escaped.join("|") : null,
  };
  return cache;
}

/** Nom du mot-clé (tel qu'il apparaît en texte, ex. « Deathknell ») → son id. */
export function getKeywordIdByName(): Map<string, string> {
  return getCache().idByName;
}

/** Source (sans délimiteurs/flags/groupes) d'une alternance regex des noms connus. */
export function getKeywordNamesPatternSource(): string | null {
  return getCache().namesPattern;
}
