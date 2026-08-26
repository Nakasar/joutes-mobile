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
 * **Ce que la bannière emportait avec elle** : l'ancienne fiche ouvrait sur une
 * photo de devanture, à laquelle on reconnaissait une boutique avant d'en lire
 * le nom. Le carré la remplace et rend cent pixels par entrée — c'est le prix
 * de la forme, et il se discute.
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
    <Link to={`/lairs/${lair.id}`} className="registry-row">
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
    </Link>
  );
}
