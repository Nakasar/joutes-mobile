/**
 * Affichage des échéances d'intervalle (rondes asynchrones).
 *
 * Une ronde jouée sur place se lit au chronomètre ; un intervalle de ligue se
 * lit en jours. Les deux formats ci-dessous répondent aux deux questions que se
 * pose le joueur : « c'est quand ? » et « il me reste combien de temps ? ».
 *
 * Tout passe par `Intl`, déjà présent dans le moteur : aucune dépendance de
 * dates n'est ajoutée au client.
 */

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** « dans 5 jours », « il y a 2 heures ». */
export function formatDeadline(iso: string, locale: string): string {
  const deltaMs = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(deltaMs)) return "";

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms || unit === "minute") {
      return formatter.format(Math.round(deltaMs / ms), unit);
    }
  }
  return "";
}

/** « lundi 4 août », sans l'année : une ligue ne s'étale pas sur des années. */
export function formatDeadlineDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
    date,
  );
}
