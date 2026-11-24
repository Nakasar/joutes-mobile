/**
 * Refait `src/companion/utilities.css` : les classes Tailwind qu'utilisent les
 * écrans du compagnon, recopiés du site. L'app n'a pas Tailwind ; on emprunte
 * celui de joutes-app, puis on borne chaque classe à `.cmp` pour qu'elle ne
 * touche rien d'autre dans l'app.
 *
 *   node scripts/build-companion-css.mjs ../joutes-app
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const app = path.resolve(process.argv[2] ?? "../joutes-app");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(app, "package.json"));
const postcss = require("postcss");
const { default: tailwind } = await import(require.resolve("@tailwindcss/postcss"));

const tw = path.join(app, "node_modules/tailwindcss");
const input = [
  `@import "${tw}/theme.css" layer(theme) theme(reference inline);`,
  `@import "${tw}/utilities.css" layer(utilities) source(none);`,
  `@source "${path.join(root, "src/companion")}";`,
].join("\n");

const result = await postcss([tailwind({ base: root, optimize: false })]).process(input, {
  from: path.join(root, "src/companion/utilities.input.css"),
});

// Chaque règle de premier niveau du calque `utilities` ne vaut que dans le compagnon.
const scoped = result.css.replace(/^ {2}(\.[^\n{]+) \{$/gm, (_, selector) => `  :is(.cmp, .cmp *)${selector} {`);

const header = `/* Généré par scripts/build-companion-css.mjs depuis les écrans de src/companion : ne pas retoucher à la main. */\n`;

// Le site part du « preflight » de Tailwind, l'app non : on en remet
// l'essentiel dans le compagnon, sous les classes utilitaires.
const preflight = `@layer properties, theme, base, utilities;
@layer base {
  :where(.cmp, .cmp *), :where(.cmp, .cmp *)::before, :where(.cmp, .cmp *)::after {
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
  :where(.cmp) :where(button, input, select, textarea) {
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    background-color: transparent;
    border-radius: 0;
  }
  :where(.cmp) :where(img, svg) {
    display: block;
    vertical-align: middle;
  }
  :where(.cmp) :where(img) {
    max-width: 100%;
    height: auto;
  }
  :where(.cmp) :where(h1, h2, h3, h4) {
    font-size: inherit;
    font-weight: inherit;
  }
}
`;
fs.writeFileSync(path.join(root, "src/companion/utilities.css"), header + preflight + scoped);
console.log("src/companion/utilities.css", scoped.length, "octets");
