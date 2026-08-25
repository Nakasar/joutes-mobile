/**
 * Les quatre fichiers de traduction portent-ils les mêmes clés ?
 *
 * Copie de `scripts/check-message-parity.mjs` de joutes-app, adaptée aux
 * chemins d'ici (`src/i18n/locales/` plutôt que `messages/`). Toute
 * modification devrait être reportée dans les deux dépôts.
 *
 * i18next lit un fichier par langue : une clé ajoutée au français et oubliée
 * ailleurs ne se voit qu'en changeant de langue, et se voit alors sous la forme
 * du nom de la clé au milieu de l'écran. Ce contrôle-là ne coûte rien et
 * remplace la relecture croisée de quatre fichiers.
 *
 * Sort en erreur s'il trouve un écart. `node scripts/check-i18n-parity.mjs`
 */

import { readFileSync } from "node:fs";

const LOCALES = ["fr", "en", "de", "it"];
const REFERENCE = "fr";

const file = (locale) => `src/i18n/locales/${locale}.json`;

/** Toutes les clés d'un objet, à plat : « trades.text.apply ». */
function flatten(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const keysByLocale = new Map(
  LOCALES.map((locale) => [
    locale,
    new Set(flatten(JSON.parse(readFileSync(file(locale), "utf8")))),
  ]),
);

const reference = keysByLocale.get(REFERENCE);
let failures = 0;

for (const locale of LOCALES) {
  if (locale === REFERENCE) continue;

  const keys = keysByLocale.get(locale);
  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));

  for (const key of missing) {
    console.error(`${file(locale)} : « ${key} » manque`);
    failures += 1;
  }
  for (const key of extra) {
    console.error(`${file(locale)} : « ${key} » n'existe pas en ${REFERENCE}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} écart(s) entre les fichiers de traduction.`);
  process.exit(1);
}

console.log(`✅ Les ${LOCALES.length} fichiers de traduction portent les mêmes clés.`);
