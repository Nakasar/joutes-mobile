import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Lair } from "../api/types";
import { currentLocale } from "../i18n";
import { colorFor, initialsOf, tintStyle } from "../lib/game-visuals";
import { readOpeningState } from "../lib/lair-hours";
import { CachedImage } from "./CachedImage";
import { ChevronIcon, LockIcon } from "./icons";

/**
 * Un lieu dans l'annuaire.
 *
 * **Le carré dit qu'on regarde un lieu** — un joueur porte un rond, un groupe
 * un blason. Le logo s'y pose en entier plutôt que recadré : c'est une marque,
 * pas une photo. Faute de logo, deux lettres sur l'accent du lieu.
 *
 * Le **cri** est l'heure du lieu : ouvert et jusqu'à quand, ou fermé. C'est ce
 * qu'on vient vérifier avant de s'y rendre, et cela se dérive des horaires que
 * la fiche affiche déjà. Quand la liste ne les sert pas, la ligne disparaît
 * plutôt que d'annoncer une fermeture qu'on ne sait pas.
 *
 * **La bannière reste** : on reconnaît une boutique où l'on est déjà allé à sa
 * devanture, bien avant d'en lire le nom. Le carré ne la remplace pas, il la
 * mord — la forme dit qu'on regarde un lieu, la photo dit lequel.
 *
 * Un lieu sans bannière n'a pas de bande vide à la place : sa carte est plus
 * courte, et se lit très bien ainsi. Un `shimmer` tenu là indéfiniment
 * annoncerait un chargement qui n'arrivera jamais.
 */
export function LairCard({
  lair,
  gameNames,
}: {
  lair: Lair;
  gameNames?: string[];
}) {
  const { t } = useTranslation();

  const accent = colorFor(lair.id, lair.options?.theme?.accentColor);
  const logo = lair.options?.theme?.logo;
  const opening = readOpeningState(lair.options?.openingHours, currentLocale());

  const blazon = [lair.address, ...(gameNames ?? [])].filter(Boolean).join(" · ");

  return (
    <Link to={`/lairs/${lair.id}`} className="registry-row registry-row--lair">
      {lair.banner && (
        <CachedImage
          src={lair.banner}
          alt=""
          className="registry-row__banner"
          loading="lazy"
        />
      )}

      <div className="registry-row__main">
        {logo ? (
          <CachedImage src={logo} alt="" className="sigil-lair sigil-lair--sm" loading="lazy" />
        ) : (
          <span className="sigil-lair sigil-lair--sm" style={tintStyle(accent)}>
            {initialsOf(lair.name)}
          </span>
        )}

        <div className="registry-row__body">
          <p className="registry-row__name">
            {/* Quatre « Caverne du Gobelin » ne se distinguent que par leur
                ville : le nom d'un lieu s'enroule sur deux lignes plutôt que de
                se couper juste avant ce qui le nomme. */}
            <span className="registry-row__handle registry-row__handle--wrap">{lair.name}</span>
            {/* Un lieu privé n'apparaît ici que pour qui y a accès : le cadenas
                dit pourquoi il ne le trouvera pas en le partageant. */}
            {lair.isPrivate && <LockIcon size={14} />}
          </p>

          {opening.isOpen !== null && (
            <p className={`cry ${opening.isOpen ? "cry--open" : "cry--quiet"}`}>
              <span className="cry__dot" aria-hidden="true" />
              {opening.isOpen
                ? opening.closesAt
                  ? t("lairs.hours.openUntil", { time: opening.closesAt })
                  : t("lairs.hours.open")
                : t("lairs.hours.closed")}
            </p>
          )}

          {blazon && <p className="blazon">{blazon}</p>}
        </div>

        <span className="chevron">
          <ChevronIcon size={18} />
        </span>
      </div>
    </Link>
  );
}
