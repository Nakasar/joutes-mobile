import { useTranslation } from "react-i18next";
import type { AchievementWithUnlockInfo } from "../api/types";
import { currentLocale } from "../i18n";
import { CachedImage } from "./CachedImage";
import { TrophyIcon } from "./icons";

function formatDate(iso: string): string {
  const date = new Date(iso);
  // Une date illisible ne doit pas afficher « Invalid Date » sous un succès :
  // le succès reste décroché, seule sa date manque.
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(currentLocale(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

/**
 * Un succès, décroché ou non.
 *
 * Les deux se lisent dans la même liste : ce qui reste à atteindre est
 * précisément ce qui donne son sens à ce qui l'a été.
 *
 * **Une seule ligne de contexte, pas deux.** Un succès décroché porte sa date —
 * savoir comment on l'obtient n'intéresse plus personne une fois qu'on l'a. Un
 * succès à décrocher porte sa description : c'est elle, et elle seule, qui dit
 * comment l'atteindre. Les afficher toutes les deux donnait trois lignes par
 * succès, dont une inutile à chaque fois.
 */
export function AchievementRow({ achievement }: { achievement: AchievementWithUnlockInfo }) {
  const { t } = useTranslation();
  const unlocked = Boolean(achievement.unlockedAt);
  const date = achievement.unlockedAt ? formatDate(achievement.unlockedAt) : "";

  const subtitle = unlocked
    ? date
      ? t("profile.achievements.unlockedOn", { date })
      : t("profile.achievements.unlocked")
    : achievement.description || t("profile.achievements.locked");

  return (
    <div className={`list-row achievement-row${unlocked ? "" : " achievement-row--locked"}`}>
      <span className="achievement-row__medal">
        {achievement.icon ? (
          <CachedImage src={achievement.icon} alt="" className="achievement-row__icon" />
        ) : (
          <TrophyIcon size={20} />
        )}
      </span>
      <div className="list-row__body">
        <p className="list-row__title">{achievement.name}</p>
        <p className="list-row__sub">{subtitle}</p>
      </div>
      {/* Les points se comptent en losanges plutôt qu'en chiffres : à ces
          valeurs-là — un à cinq — on les lit sans les lire, et le losange est
          déjà la marque de l'héraldique de Joutes. Décroché il est plein, à
          décrocher il n'est qu'un contour.

          Un succès-statut vaut zéro point : il n'a alors aucun losange, plutôt
          qu'un « 0 » qui le ferait passer pour un succès sans valeur — il en a
          une autre, et elle se porte à côté du pseudonyme. */}
      {achievement.points ? (
        <span
          className={`lozenges${unlocked ? "" : " lozenges--empty"}`}
          aria-label={t("profile.achievements.points", { count: achievement.points })}
        >
          {Array.from({ length: achievement.points }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      ) : null}
    </div>
  );
}
