import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Deck } from "../api/types";
import { ChevronIcon, LayersIcon, StarIcon } from "./icons";
import { DeckVisibilityBadge } from "./DeckBadges";

/**
 * Un deck dans une liste : ce qu'il faut pour le reconnaître et décider de
 * l'ouvrir — son nom, sa légende ou son format, et qui l'a publié.
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

  return (
    <Link to={`/decks/${deck.id}`} className="list-row list-row--link">
      <span className="list-row__icon" style={{ background: "var(--chip)" }}>
        <LayersIcon size={20} style={{ color: "var(--primary)" }} />
      </span>
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
