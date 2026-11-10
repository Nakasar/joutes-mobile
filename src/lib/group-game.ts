/**
 * Petits calculs d'affichage du jeu dans un groupe : couleurs des domaines,
 * bilans, pourcentages. Repris du site (`lib/meta/domains.ts`) pour que les
 * deux montrent les mêmes teintes.
 */

const DOMAIN_COLORS: Record<string, string> = {
  fury: "#e5484d",
  calm: "#30a46c",
  mind: "#3e8ed0",
  body: "#f08c2e",
  chaos: "#8e4ec6",
  order: "#d4b106",
};

const FALLBACK = ["#0ea5e9", "#a855f7", "#14b8a6", "#f43f5e", "#84cc16", "#f59e0b"];

/** La couleur d'un domaine : celle de Riftbound, sinon une teinte stable tirée du nom. */
export function domainColor(domain: string): string {
  const known = DOMAIN_COLORS[domain.toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (const char of domain) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK[hash % FALLBACK.length];
}

/** « 6-2-1 » : victoires, défaites, nuls. */
export function recordLabel(record: { wins: number; losses: number; draws: number }): string {
  return `${record.wins}-${record.losses}-${record.draws}`;
}

/** Le nom court d'une légende : « Kai'Sa » pour « Kai'Sa, Daughter of the Void ». */
export function shortLegend(name: string): string {
  return name.split(",")[0].trim();
}

/** Un classement dans le top 8 (ou dans le top annoncé du tournoi). */
export function isTopCut(placement?: number, topCut?: number): boolean {
  return placement !== undefined && placement <= (topCut ?? 8);
}

/** Les pourcentages de la méta, sans décimale, dans la langue de l'écran. */
export function percentFormatter(locale: string): (value: number) => string {
  const format = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  return (value) => format.format(value);
}

/** L'écart en points entre la part du groupe et celle de la méta : « +23 », « −4 », « 0 ». */
export function pointsDelta(share: number, metaShare: number): string {
  const points = Math.round((share - metaShare) * 100);
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0";
}

/**
 * Un classement dans la langue de l'écran : « 1er », « 3e », « 2nd », « 4. ».
 * Écrit ici plutôt qu'en clés de traduction ordinales : la parité des quatre
 * fichiers interdit des clés que seules certaines langues déclinent.
 */
export function placementLabel(place: number, locale: string): string {
  const language = locale.slice(0, 2);
  if (language === "fr") return place === 1 ? "1er" : `${place}e`;
  if (language === "en") {
    const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(place);
    const suffix = { one: "st", two: "nd", few: "rd" }[rule as "one" | "two" | "few"] ?? "th";
    return `${place}${suffix}`;
  }
  if (language === "it") return `${place}º`;
  return `${place}.`;
}
