// Le texte des cartes / règles Riftbound intègre des glyphes inline sous forme
// de balises `:rb_<name>:` (ex. `:rb_energy_1:`, `:rb_might:`). Les réécrire en
// images markdown permet au rendu ReactMarkdown existant de les transformer en
// véritables icônes. (Identique à `lib/riftbound-icons.ts` côté joutes-app.)
const ICON_TAG_REGEX = /:rb_([a-z0-9_]+):/g;
const ICON_BASE_URL =
  "https://assetcdn.rgpub.io/public/live/riot-shared/player-experiences/riot-glyphs/rb/latest";

// Quelques glyphes courants apparaissent aussi sous forme de raccourci entre
// crochets au lieu des balises `:rb_x:` : [A]/[C] pour un coût de rune
// arc-en-ciel (n'importe quelle couleur), [M] pour la Puissance (Might), et
// [<n>] pour un coût d'énergie de n.
const BRACKET_ICON_REGEX = /\[(A|C|M|\d+)\]/g;
const BRACKET_ICON_NAMES: Record<string, string> = {
  A: "rune_rainbow",
  C: "rune_rainbow",
  M: "might",
};

function iconUrl(name: string): string {
  return `${ICON_BASE_URL}/${name}.svg`;
}

export function replaceIconTags(text: string): string {
  let result = text.replace(
    ICON_TAG_REGEX,
    (_full, name: string) => `![${name}](${iconUrl(name)})`,
  );

  result = result.replace(BRACKET_ICON_REGEX, (_full, token: string) => {
    const name = /^\d+$/.test(token)
      ? `energy_${token}`
      : BRACKET_ICON_NAMES[token];
    return `![${name}](${iconUrl(name)})`;
  });

  return result;
}
