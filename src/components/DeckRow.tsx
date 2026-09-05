import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Deck } from "../api/types";
import { CachedImage } from "./CachedImage";
import { ChevronIcon, LayersIcon, StarIcon } from "./icons";
import { DeckVisibilityBadge } from "./DeckBadges";
import { deckCoverPosition, resolveDeckCover } from "../lib/deck-cover";

/**
 * Un deck dans une liste : ce qu'il faut pour le reconnaître et décider de
 * l'ouvrir — son nom, sa légende ou son format, et qui l'a publié.
 *
 * **Le nom passe avant les pastilles.** Une visibilité comme « Non répertorié »
 * est large, et sur un téléphone étroit elle prenait la place du nom, réduit à
 * « Contr… ». La rangée passe donc à la ligne : le nom garde sa largeur, les
 * pastilles descendent sous lui quand elles ne tiennent plus.
 *
 * La taille du deck n'y figure pas : elle se dérive du contenu, que la liste ne
 * charge pas. L'annoncer ici demanderait de résoudre le catalogue pour vingt
 * decks à chaque page.
 */
export function DeckRow({ deck, showAuthor }: { deck: Deck; showAuthor?: boolean }) {
  const { t } = useTranslation();

  const subtitle = [
    deck.legendName,
    deck.format,
    showAuthor ? deck.creatorName : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  // La couverture, quand le deck en a une : c'est elle qui distingue deux
  // decks d'un coup d'œil. Sans catalogue sous la main, la valeur
  // dénormalisée suffit — c'est ce pour quoi le serveur l'écrit.
  const cover = resolveDeckCover(deck);

  return (
    <Link to={`/decks/${deck.id}`} className="list-row list-row--link deck-row">
      {cover.image ? (
        <CachedImage
          src={cover.image}
          alt=""
          className="list-row__thumb deck-row__cover"
          style={{ objectPosition: deckCoverPosition(cover.source) }}
        />
      ) : (
        <span className="list-row__icon" style={{ background: "var(--chip)" }}>
          <LayersIcon size={20} style={{ color: "var(--primary)" }} />
        </span>
      )}
      <div className="list-row__body">
        <p className="list-row__title">{deck.name}</p>
        <p className="list-row__sub">{subtitle || t("decks.noLegend")}</p>
      </div>
      <div className="deck-row__meta">
        <DeckVisibilityBadge visibility={deck.visibility} />
        {deck.favoritesCount ? (
          <span className="chip">
            <StarIcon size={13} />
            {deck.favoritesCount}
          </span>
        ) : null}
      </div>
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}
