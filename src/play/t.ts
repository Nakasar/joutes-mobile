import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import de from "./i18n/de.json";
import en from "./i18n/en.json";
import fr from "./i18n/fr.json";
import it from "./i18n/it.json";

/**
 * Les textes de la table viennent tels quels du site (`messages/*.json` de
 * joutes-app, `Games.Play` et `Games.PlaySwu`) : même table, mêmes mots, dans
 * les quatre langues. Ils sont écrits au format ICU de next-intl
 * (`{count, plural, one {…} other {…}}`) que i18next ne lit pas : ce petit
 * interprète en couvre ce que ces textes emploient (variables, `plural` avec
 * `=n`, `one`, `other` et `#`, `select`).
 *
 * `Mobile` porte ce que l'app dit autrement que le site (« touchez » plutôt
 * que « cliquez ») ou en plus (le panneau repliable) ; il passe devant.
 */

type Tree = { [key: string]: string | Tree };
type Values = Record<string, string | number>;

const DICTS: Record<string, Tree> = { fr, en, de, it } as unknown as Record<string, Tree>;

function lookup(tree: Tree | undefined, path: string): string | Tree | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of path.split(".")) {
    if (!node || typeof node === "string") return undefined;
    node = node[part];
  }
  return node;
}

/** L'argument ICU qui commence à `start` (juste après `{`) : sa fin, au `}` correspondant. */
function closing(text: string, start: number): number {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

/** Les branches `clé {texte}` d'un `plural` ou d'un `select`. */
function branches(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    const keyStart = i;
    while (i < body.length && body[i] !== "{" && !/\s/.test(body[i])) i++;
    const key = body.slice(keyStart, i);
    while (i < body.length && body[i] !== "{") i++;
    if (i >= body.length) break;
    const end = closing(body, i + 1);
    out.set(key, body.slice(i + 1, end));
    i = end + 1;
  }
  return out;
}

export function formatIcu(text: string, values: Values, locale: string, count?: number): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === "#" && count !== undefined) {
      out += new Intl.NumberFormat(locale).format(count);
      i++;
      continue;
    }
    if (char !== "{") {
      out += char;
      i++;
      continue;
    }
    const end = closing(text, i + 1);
    const inner = text.slice(i + 1, end);
    i = end + 1;
    const comma = inner.indexOf(",");
    if (comma < 0) {
      const value = values[inner.trim()];
      out += value === undefined ? `{${inner}}` : String(value);
      continue;
    }
    const name = inner.slice(0, comma).trim();
    const rest = inner.slice(comma + 1);
    const second = rest.indexOf(",");
    const kind = (second < 0 ? rest : rest.slice(0, second)).trim();
    const options = branches(second < 0 ? "" : rest.slice(second + 1));
    const value = values[name];
    if (kind === "plural") {
      const n = Number(value ?? 0);
      const exact = options.get(`=${n}`);
      const branch = exact ?? options.get(new Intl.PluralRules(locale).select(n)) ?? options.get("other") ?? "";
      out += formatIcu(branch, values, locale, n);
    } else if (kind === "select") {
      const branch = options.get(String(value)) ?? options.get("other") ?? "";
      out += formatIcu(branch, values, locale, count);
    } else {
      out += value === undefined ? "" : String(value);
    }
  }
  return out;
}

export type PlayT = ((key: string, values?: Values) => string) & { has: (key: string) => boolean };

/**
 * Le traducteur d'un espace (`"Play"`, `"PlaySwu"`, ou un sous-espace comme
 * `"Play.payment"`). Une clé absente retombe sur le français, puis sur elle-même.
 */
export function usePlayT(namespace: string): PlayT {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language ?? "fr").slice(0, 2);
  const dict = DICTS[language] ?? DICTS.fr;

  const find = useCallback(
    (key: string): string | undefined => {
      const path = `${namespace}.${key}`;
      for (const tree of [dict, DICTS.fr]) {
        const own = lookup(tree, `Mobile.${path}`) ?? lookup(tree, path);
        if (typeof own === "string") return own;
      }
      return undefined;
    },
    [dict, namespace],
  );

  const t = useCallback(
    (key: string, values: Values = {}) => {
      const text = find(key);
      return text === undefined ? key : formatIcu(text, values, language);
    },
    [find, language],
  ) as PlayT;
  t.has = (key: string) => find(key) !== undefined;
  return t;
}
