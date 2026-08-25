import { useTranslation } from "react-i18next";
import type { LairOpeningHours } from "../api/types";
import { currentLocale } from "../i18n";
import { formatOpeningRanges, readOpeningState, weekOf } from "../lib/lair-hours";

/**
 * Les horaires du lieu : où on en est maintenant, puis la semaine.
 *
 * L'état du moment passe devant, parce que c'est la seule question qu'on se
 * pose en ouvrant la fiche à 18h55 — et l'heure annoncée est celle de la plage
 * **en cours**, pas la dernière du jour : sur des horaires coupés, promettre
 * 19h à quelqu'un qui lit à 11h l'enverrait devant une porte close à midi.
 *
 * Un lieu sans horaires enregistrés n'affiche rien du tout : « horaires
 * inconnus » n'apprend rien que l'absence de la carte ne dise déjà.
 */
export function LairHours({ hours }: { hours: LairOpeningHours[] | undefined }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const state = readOpeningState(hours, locale);

  if (state.isOpen === null) {
    return null;
  }

  return (
    <section className="card lair-hours">
      <p className={`lair-hours__now${state.isOpen ? " lair-hours__now--open" : ""}`}>
        <span className="lair-hours__dot" />
        {state.isOpen
          ? state.closesAt
            ? t("lairs.hours.openUntil", { time: state.closesAt })
            : t("lairs.hours.open")
          : t("lairs.hours.closed")}
      </p>

      <ul className="lair-hours__week">
        {weekOf(hours).map(({ day, ranges }) => {
          const formatted = formatOpeningRanges(ranges, locale);
          return (
            <li
              key={day}
              className={`lair-hours__day${day === state.todayDay ? " lair-hours__day--today" : ""}`}
            >
              <span className="lair-hours__label">{t(`lairs.hours.days.${day}`)}</span>
              <span className="lair-hours__ranges">
                {formatted.length > 0 ? formatted.join(", ") : t("lairs.hours.closedDay")}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
