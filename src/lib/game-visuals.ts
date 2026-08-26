/** Palette de repli pour colorer un jeu / avatar quand l'API n'expose pas de couleur. */
const PALETTE = ["#0091c7", "#00a692", "#b8912f", "#7b5cff", "#e8517a", "#2bb7dc"];

/** Couleur stable dérivée d'une chaîne (id/slug) si aucune couleur n'est fournie. */
export function colorFor(seed: string, explicit?: string | null): string {
  if (explicit) return explicit;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Première lettre significative pour une pastille avatar. */
export function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

/**
 * Les mots que le français met entre deux noms et qui ne portent aucune
 * identité. Les compter comme initiale donnait « Caverne du Gobelin » → CD et
 * « Comptoir des Arcanes » → CD : deux boutiques différentes, le même sigle —
 * exactement la confusion que deux lettres devaient lever.
 */
const PARTICLES = new Set([
  "a", "à", "au", "aux", "d", "da", "de", "des", "du", "el", "en", "et", "l",
  "la", "le", "les", "lo", "of", "the", "un", "une", "y",
]);

/**
 * Deux lettres pour un carré : « L'Antre-Temps » donne AT, « Caverne du
 * Gobelin » donne CG.
 *
 * Le carré d'un lieu est plus large qu'un rond de joueur et tient deux lettres
 * sans se serrer — et deux lettres distinguent deux boutiques d'une même rue là
 * où une seule initiale les confondrait. Encore faut-il que ce soient les deux
 * bonnes : les particules sont sautées, sauf quand il ne reste qu'elles.
 *
 * Un nom d'un seul mot retombe sur son initiale plutôt que d'aller chercher sa
 * deuxième lettre, qui ne dit rien.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/[\s'-]+/)
    .filter(Boolean);

  // « Le Dé Cornu » n'a que deux mots pleins, « L'Antre-Temps » aussi : on ne
  // retire les particules que si le nom en garde assez pour deux lettres.
  const strong = words.filter((word) => !PARTICLES.has(word.toLowerCase()));
  const kept = strong.length >= 2 ? strong : words;

  if (kept.length >= 2) {
    return (initialOf(kept[0]) + initialOf(kept[1])).toUpperCase();
  }
  return initialOf(name);
}

/** Style de pastille avatar teintée (fond = couleur à faible opacité, texte = couleur). */
export function tintStyle(color: string): { background: string; color: string } {
  return { background: `${color}1f`, color };
}
