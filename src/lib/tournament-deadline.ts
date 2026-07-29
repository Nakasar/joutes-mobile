/**
 * Affichage des échéances d'intervalle (rondes asynchrones).
 *
 * Une ronde jouée sur place se lit au chronomètre ; un intervalle de ligue se
 * lit en jours. Les deux formats ci-dessous répondent aux deux questions que se
 * pose le joueur : « c'est quand ? » et « il me reste combien de temps ? ».
 *
 * Toutes les fonctions prennent l'instant de référence en paramètre plutôt que
 * de lire l'horloge : c'est l'heure du serveur qui fait foi, corrigée du
 * décalage de l'appareil (`serverOffsetMs`), comme pour le minuteur. Un
 * téléphone à l'heure fausse afficherait sinon une échéance déjà dépassée.
 *
 * Tout passe par `Intl`, déjà présent dans le moteur : aucune dépendance de
 * dates n'est ajoutée au client.
 */

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** Instant de référence, corrigé du décalage d'horloge client/serveur. */
export function serverNowMs(serverOffsetMs: number): number {
  return Date.now() + serverOffsetMs;
}

/** « dans 5 jours », « il y a 2 heures ». */
export function formatDeadline(iso: string, locale: string, nowMs: number = Date.now()): string {
  const deltaMs = new Date(iso).getTime() - nowMs;
  if (!Number.isFinite(deltaMs)) return "";

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms || unit === "minute") {
      return formatter.format(Math.round(deltaMs / ms), unit);
    }
  }
  return "";
}

/** L'échéance est-elle dépassée, à l'heure du serveur ? */
export function deadlineIsPast(iso: string, nowMs: number = Date.now()): boolean {
  const deadlineMs = new Date(iso).getTime();
  return Number.isFinite(deadlineMs) && deadlineMs < nowMs;
}

/** « lundi 4 août », sans l'année : une ligue ne s'étale pas sur des années. */
export function formatDeadlineDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
    date,
  );
}
