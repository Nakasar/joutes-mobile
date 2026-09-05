import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Deck } from "../api/types";
import { deckCoverPosition, resolveDeckCover } from "../lib/deck-cover";
import { colorFor } from "../lib/game-visuals";
import { CachedImage } from "./CachedImage";
import { StarIcon } from "./icons";

/**
 * Un deck montré par son illustration de légende.
 *
 * C'est elle qui distingue deux decks d'un coup d'œil, bien avant leur nom :
 * une liste de rangées à pastille bleue se lit ligne à ligne, une liste
 * d'illustrations se reconnaît. Même cadrage que le web (`PinnedDeckGrid`) :
 * l'image est recadrée **par le haut**, là où se trouve le personnage — centrée,
 * elle ne montrerait qu'un morceau de décor.
 *
 * Faute d'illustration — deck sans légende, jeu sans catalogue de cartes, ou
 * catalogue injoignable — la carte garde son bandeau, teinté de la couleur
 * dérivée du deck : un gabarit sans image reste un gabarit, là où une carte
 * amputée de son haut n'aurait plus de forme.
 *
 * `DeckRow`, la rangée compacte, reste en service ailleurs (librairie,
 * recherche) : elle liste vingt decks, ce que ce gabarit-ci ne sait pas faire.
 */
export function DeckCard({
  deck,
  legendImage,
  gameName,
}: {
  deck: Deck;
  legendImage?: string;
  gameName?: string;
}) {
  const { t } = useTranslation();
  const color = colorFor(deck.id);

  // La couverture choisie par l'auteur passe avant la légende que l'appelant a
  // résolue : c'est l'ordre de `resolveDeckCover`, le même que sur le site.
  const cover = resolveDeckCover(deck);
  const image = cover.source === "upload" || cover.source === "card"
    ? (cover.image ?? legendImage)
    : (legendImage ?? cover.image);
  const position = image === legendImage ? "top" : deckCoverPosition(cover.source);

  const subtitle = [deck.legendName, deck.format].filter(Boolean).join(" · ");

  return (
    <Link to={`/decks/${deck.id}`} className="deck-card">
      <span
        className="deck-card__art"
        style={
          image
            ? undefined
            : { background: `linear-gradient(150deg, ${color}3d, ${color}14)` }
        }
      >
        {image && (
          <CachedImage src={image} alt="" loading="lazy" style={{ objectPosition: position }} />
        )}
        <span className="deck-card__fade" />
      </span>

      <div className="deck-card__body">
        <div className="deck-card__text">
          {gameName && <span className="deck-card__game">{gameName}</span>}
          <p className="deck-card__name">{deck.name}</p>
          <p className="deck-card__sub">{subtitle || t("decks.noLegend")}</p>
        </div>

        {deck.favoritesCount ? (
          <span className="chip">
            <StarIcon size={13} />
            {deck.favoritesCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
