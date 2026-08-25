import { Link } from "react-router-dom";
import type { Lair } from "../api/types";
import { CachedImage } from "./CachedImage";
import { LockIcon, PinIcon } from "./icons";

/**
 * Un lieu dans l'annuaire.
 *
 * La bannière tient la moitié de la carte : c'est à elle qu'on reconnaît une
 * boutique où l'on est déjà allé, bien avant de lire son nom. Sans bannière, un
 * `shimmer` garde le cadre plutôt que de laisser la carte se replier — deux
 * hauteurs de carte dans une même liste se lisent comme deux natures de lieu.
 */
export function LairCard({
  lair,
  gameNames,
}: {
  lair: Lair;
  gameNames?: string[];
}) {
  return (
    <Link to={`/lairs/${lair.id}`} className="lair-card lair-card--link">
      <div className="lair-card__media">
        {lair.banner ? (
          <CachedImage src={lair.banner} alt="" loading="lazy" />
        ) : (
          <div className="shimmer" style={{ width: "100%", height: "100%" }} />
        )}
      </div>
      <div className="lair-card__body">
        <h2 className="lair-card__name">
          {lair.name}
          {/* Un lieu privé n'apparaît ici que pour qui y a accès : le cadenas
              dit pourquoi il ne le trouvera pas en le partageant. */}
          {lair.isPrivate && <LockIcon size={14} />}
        </h2>
        {lair.address && (
          <p className="lair-card__where">
            <PinIcon size={14} />
            {lair.address}
          </p>
        )}
        {gameNames && gameNames.length > 0 && (
          <p className="lair-card__games">{gameNames.join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}
