/**
 * Les horaires d'ouverture d'un lieu — portage de `lib/lairs/opening-hours.ts`
 * de joutes-app, pur et testé là-bas. Toute modification doit être reportée
 * dans les deux dépôts : deux lectures différentes déclareraient le même lieu
 * ouvert ici et fermé là.
 *
 * **Deux écarts assumés avec l'original.**
 *
 * `luxon` n'existe pas ici : `DateTime` est remplacé par `Date` et
 * `Intl.DateTimeFormat`, et la seule chose qu'on lui demandait — le jour ISO,
 * l'heure, la minute, et le formatage local d'une heure — se refait à la main
 * sans elle. `Date#getDay` numérote le dimanche `0` ; `isoDay` le ramène sur
 * `7`, exactement comme il le fait déjà pour les horaires les plus anciens.
 *
 * `findOverlappingDay` et `MAX_OPENING_RANGES_PER_DAY` ne sont pas portés :
 * ils valident une **saisie**, et le mobile ne saisit pas d'horaires.
 */

/** Une plage d'ouverture, un jour de la semaine. */
export type LairOpeningHours = {
  /** ISO : 1 = lundi … 7 = dimanche. Les plus anciens portent `0` pour dimanche. */
  day: number;
  /** "10:00" */
  open?: string;
  /** "19:00" */
  close?: string;
};

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DAY = 24 * 60;

function minutesOf(time: string | undefined): number | null {
  const match = time && TIME.exec(time.trim());
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Le jour ISO d'une plage : 1 = lundi … 7 = dimanche.
 *
 * Les horaires écrits avant que cette numérotation soit fixée portent `0` pour
 * le dimanche. Les laisser tels quels effacerait le dimanche de la vitrine : la
 * semaine se compose de 1 à 7, et un jour `0` n'y trouverait aucune ligne où
 * s'afficher.
 */
export function isoDay(day: number): number {
  return day === 0 ? 7 : day;
}

/** La plage est-elle exploitable — a-t-elle au moins une heure d'ouverture ? */
function isOpenRange(hours: LairOpeningHours): boolean {
  return minutesOf(hours.open) !== null;
}

/**
 * Les plages d'un jour donné, dans l'ordre de la journée.
 *
 * Plusieurs plages pour un même jour décrivent une coupure — « 10h — 12h » puis
 * « 14h — 19h ». L'ordre de la liste enregistrée n'est pas garanti : c'est
 * l'heure d'ouverture qui range.
 */
export function rangesOfDay(
  openingHours: LairOpeningHours[] | undefined,
  day: number,
): LairOpeningHours[] {
  return (openingHours ?? [])
    .filter((hours) => isoDay(hours.day) === day && isOpenRange(hours))
    .sort((a, b) => (minutesOf(a.open) ?? 0) - (minutesOf(b.open) ?? 0));
}

export type LairOpeningState = {
  /** Le lieu est-il ouvert à l'instant ? `null` si les horaires sont inconnus. */
  isOpen: boolean | null;
  /** Les plages du jour, dans l'ordre. Vide si le lieu n'ouvre pas aujourd'hui. */
  today: LairOpeningHours[];
  /** Le jour ISO courant, pour reconnaître sa ligne dans la semaine. */
  todayDay: number;
  /**
   * L'heure de fermeture de la plage **en cours**, « 19h » / « 19h30 », pour la
   * ligne de bannière. `null` quand le lieu est fermé.
   */
  closesAt: string | null;
};

/**
 * Formate une heure d'ouverture à la française : « 10h », « 19h30 ».
 *
 * Sur les autres langues, le séparateur horaire local reprend la main — un
 * anglophone lit « 7:30 PM » et non « 19h30 ».
 */
export function formatOpeningTime(time: string | undefined, locale: string): string | null {
  const minutes = minutesOf(time);
  if (minutes === null) {
    return null;
  }

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  if (locale.startsWith("fr")) {
    return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
  }

  // Un jour arbitraire : seule l'heure sera lue, et la date n'entre dans aucun
  // des formats demandés.
  const moment = new Date(2000, 0, 1, hour, minute);

  // `minute: "numeric"` et non `"2-digit"` : c'est le squelette de
  // `DateTime.TIME_SIMPLE` de luxon, celui qu'emploie l'original. La nuance
  // n'est pas cosmétique — en allemand et en italien, ce squelette-là fait
  // aussi remplir l'heure (« 09:05 »), quand `"2-digit"` rendrait « 9:05 ».
  return new Intl.DateTimeFormat(
    locale,
    minute === 0 ? { hour: "numeric" } : { hour: "numeric", minute: "numeric" },
  ).format(moment);
}

/** Une plage, « 10h — 19h », ou `null` si elle ne porte pas d'heure d'ouverture. */
export function formatOpeningRange(
  hours: LairOpeningHours | undefined,
  locale: string,
): string | null {
  const open = formatOpeningTime(hours?.open, locale);
  const close = formatOpeningTime(hours?.close, locale);

  if (!open) {
    return null;
  }

  return close ? `${open} — ${close}` : open;
}

/** Les plages d'un jour, formatées : `["10h — 12h", "14h — 19h"]`. */
export function formatOpeningRanges(hours: LairOpeningHours[], locale: string): string[] {
  return hours.flatMap((range) => {
    const formatted = formatOpeningRange(range, locale);
    return formatted ? [formatted] : [];
  });
}

/**
 * La plage court-elle à `minutes`, comptées depuis minuit du jour de la plage ?
 *
 * Une plage qui se termine avant son début — « 20h — 02h » — est lue comme
 * débordant sur le lendemain : c'est le cas d'un lieu qui ferme après minuit,
 * et le traiter autrement le déclarerait fermé toute la soirée.
 */
function isWithin(hours: LairOpeningHours, minutes: number): boolean {
  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  if (open === null || close === null) {
    return false;
  }

  const end = close <= open ? close + DAY : close;
  return minutes >= open && minutes < end;
}

/**
 * L'état d'ouverture du lieu, maintenant.
 *
 * Sur des horaires coupés, c'est la plage **en cours** qui donne l'heure de
 * fermeture annoncée : à 11h, un lieu ouvert « 10h — 12h » puis « 14h — 19h »
 * ferme à 12h, et promettre 19h enverrait le visiteur devant une porte close.
 */
export function readOpeningState(
  openingHours: LairOpeningHours[] | undefined,
  locale: string,
  now: Date = new Date(),
): LairOpeningState {
  // `getDay` numérote le dimanche `0` — même conversion que pour les horaires.
  const todayDay = isoDay(now.getDay());

  if (!openingHours || openingHours.length === 0) {
    return { isOpen: null, today: [], todayDay, closesAt: null };
  }

  const today = rangesOfDay(openingHours, todayDay);
  const yesterday = rangesOfDay(openingHours, todayDay === 1 ? 7 : todayDay - 1);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // La veille compte aussi : sa dernière plage peut déborder sur la nuit, et
  // c'est alors elle qui tient le lieu ouvert à 1h du matin.
  const current =
    today.find((hours) => isWithin(hours, nowMinutes)) ??
    yesterday.find((hours) => isWithin(hours, nowMinutes + DAY)) ??
    null;

  return {
    isOpen: current !== null,
    today,
    todayDay,
    closesAt: current ? formatOpeningTime(current.close, locale) : null,
  };
}

/** Un jour de la semaine et ses plages — vides quand le lieu est fermé. */
export type LairOpeningDay = {
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  day: number;
  ranges: LairOpeningHours[];
};

/** Les sept jours, dans l'ordre de la semaine, complétés par les jours fermés. */
export function weekOf(openingHours: LairOpeningHours[] | undefined): LairOpeningDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, ranges: rangesOfDay(openingHours, day) }));
}
