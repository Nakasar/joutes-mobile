import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RegistryEntry } from "../api/types";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userLabel, userProfilePath } from "../lib/user-tag";
import { CachedImage } from "./CachedImage";
import { ChevronIcon, PinIcon } from "./icons";

/** Au-delà, les puces sortiraient de la fiche : le reste se compte. */
const GAMES_SHOWN = 2;

/**
 * Une fiche du registre : de quoi reconnaître un joueur et décider de l'ouvrir.
 *
 * Les jeux qu'il suit sont la seule chose qui distingue vraiment deux comptes
 * dans une liste — d'où leur place, en puces plutôt qu'en énumération séparée
 * par des virgules : une liste de noms collés ne se parcourt pas du regard, et
 * celle d'un joueur qui suit six jeux poussait la ville hors de la fiche.
 *
 * La ville rejoint le compteur d'abonnés sur la même ligne : c'est le second
 * critère du registre — on cherche qui joue à quoi, et où.
 *
 * Le direct s'écrit en toutes lettres. La pastille rouge seule oblige à
 * connaître la convention, et c'est précisément ce qu'on vient chercher quand
 * on filtre dessus.
 */
export function PlayerRow({ entry }: { entry: RegistryEntry }) {
  const { t } = useTranslation();
  const { user } = entry;
  const label = userLabel(user);

  // `userLabel` rend « Pseudo#1234 » : le discriminant passe en retrait, il sert
  // à départager deux homonymes, pas à les nommer.
  const hash = label.lastIndexOf("#");
  const name = hash > 0 ? label.slice(0, hash) : label;
  const tag = hash > 0 ? label.slice(hash) : "";

  const shown = entry.games.slice(0, GAMES_SHOWN);
  const rest = entry.games.length - shown.length;

  const meta = [
    user.city,
    t("players.followersCount", { count: entry.followers }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link to={userProfilePath(user)} className="player-row">
      {user.avatar ? (
        <CachedImage src={user.avatar} alt="" className="avatar avatar--sm" />
      ) : (
        <span className="avatar avatar--sm" style={tintStyle(colorFor(user.id))}>
          {initialOf(label)}
        </span>
      )}

      <div className="player-row__body">
        <p className="player-row__name">
          <span className="player-row__handle">
            {name}
            {tag && <span className="player-row__tag">{tag}</span>}
          </span>
          {entry.isLive && (
            <span className="live-pill">
              <span className="live-dot" />
              {t("players.live")}
            </span>
          )}
        </p>

        <p className="player-row__meta">
          {user.city && <PinIcon size={13} />}
          {meta}
        </p>

        {entry.games.length > 0 && (
          <div className="player-row__games">
            {shown.map((game) => (
              <span key={game._id} className="game-pill">
                {game.name}
              </span>
            ))}
            {rest > 0 && <span className="game-pill game-pill--more">+{rest}</span>}
          </div>
        )}
      </div>

      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}
