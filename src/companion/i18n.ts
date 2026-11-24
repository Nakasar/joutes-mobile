import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Les textes du compagnon sont ceux du site, au format ICU (`{name}`,
 * `{n, plural, one {…} other {…}}`) : on les recopie tels quels dans la clé
 * `companion` des langues de l'app, et ce petit formateur les lit. Les écrans
 * portés du site gardent ainsi leur `t("clé", { … })`.
 */
export function useTranslations(_namespace?: string) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "fr";
  return useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const raw = t(`companion.${key}`);
      return formatIcu(typeof raw === "string" ? raw : key, values ?? {}, lang);
    },
    [t, lang],
  );
}

/** Remplace `{x}` et les pluriels ICU ; `#` vaut le nombre du pluriel. */
export function formatIcu(message: string, values: Record<string, string | number>, lang: string): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf("{", i);
    if (open < 0) {
      out += message.slice(i);
      break;
    }
    out += message.slice(i, open);
    const close = matchingBrace(message, open);
    if (close < 0) {
      out += message.slice(open);
      break;
    }
    out += formatArgument(message.slice(open + 1, close), values, lang);
    i = close + 1;
  }
  return out;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === "{") depth++;
    else if (text[k] === "}") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

function formatArgument(body: string, values: Record<string, string | number>, lang: string): string {
  const parts = body.split(",");
  const name = parts[0].trim();
  if (parts.length < 3 || parts[1].trim() !== "plural") {
    const value = values[name];
    return value === undefined ? `{${name}}` : String(value);
  }
  const count = Number(values[name] ?? 0);
  const options = body.slice(body.indexOf(",", body.indexOf(",") + 1) + 1);
  const branches = new Map<string, string>();
  let k = 0;
  while (k < options.length) {
    const open = options.indexOf("{", k);
    if (open < 0) break;
    const close = matchingBrace(options, open);
    if (close < 0) break;
    branches.set(options.slice(k, open).trim(), options.slice(open + 1, close));
    k = close + 1;
  }
  const category = new Intl.PluralRules(lang).select(count);
  const branch = branches.get(`=${count}`) ?? branches.get(category) ?? branches.get("other") ?? "";
  return formatIcu(branch.split("#").join(String(count)), values, lang);
}

/** La langue de l'interface, comme `useLocale` de next-intl sur le site. */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage ?? i18n.language ?? "fr";
}
