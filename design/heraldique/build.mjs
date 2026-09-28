/*
 * Assemblage des planches du canevas « Héraldique ».
 *
 * Une planche du canevas est un fichier complet : le format Design Components
 * ne connaît ni import ni feuille partagée. Les jetons et les composants
 * communs vivent donc dans `_base.css`, et ce script les recopie dans chaque
 * `<Nom>.dc.html` à partir du corps gardé sous `parts/`.
 *
 *   node build.mjs        (puis `node .../seed-canvas.mjs --artboard …`)
 *
 * Ne pas éditer les `.dc.html` à la main : ils sont réécrits à chaque passage.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const base = readFileSync(new URL("./_base.css", import.meta.url), "utf8").trimEnd();

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";

const indent = (text, pad) =>
  text
    .split("\n")
    .map((line) => (line.trim() ? pad + line : ""))
    .join("\n");

for (const file of readdirSync(new URL("./parts/", import.meta.url)).sort()) {
  if (!file.endsWith(".html")) continue;
  const name = file.replace(/\.html$/, "");
  const part = readFileSync(new URL(`./parts/${file}`, import.meta.url), "utf8");

  // Une planche peut ajouter ses propres règles : le premier bloc `<style>`
  // du fragment part dans le helmet, sous les règles communes.
  const extra = part.match(/^<style>\n([\s\S]*?)\n<\/style>\n/);
  const body = extra ? part.slice(extra[0].length) : part;

  const css = extra ? `${base}\n\n${extra[1].trimEnd()}` : base;

  // La classe logique est un frère de `<x-dc>`, pas un enfant : le fragment la
  // porte à la fin, on la sort ici.
  const split = body.match(/^([\s\S]*?)\n(<script data-dc-script[\s\S]*)$/);
  const template = (split ? split[1] : body).trimEnd();
  const logic = split ? `\n\n${split[2].trimEnd()}` : "";

  writeFileSync(
    new URL(`../heraldique/${name}.dc.html`, import.meta.url),
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTS}">
  <style>
${indent(css, "    ")}
  </style>
</helmet>

${template}
</x-dc>${logic}
</body>
</html>
`,
  );
  console.log("écrit", `${name}.dc.html`);
}
