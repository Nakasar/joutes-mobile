import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RegistryEntry } from "../api/types";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userLabel, userProfilePath } from "../lib/user-tag";
import { CachedImage } from "./CachedImage";
import { ChevronIcon } from "./icons";

/**
 * Une fiche du registre : de quoi reconnaître un joueur et décider de l'ouvrir.
 *
 * **Le rond dit qu'on regarde une personne** — un lieu porte un carré, un
 * groupe un blason. La forme se lit avant la couleur et bien avant le nom.
 *
 * Le nom passe en héraldique, comme au rôle d'armes des groupes : c'est ce qui
 * rattache le registre au reste de l'héraldique de Joutes sans lui donner un
 * fond à part.
 *
 * Le **blasonnement** — ville et jeux dits d'un trait, en petite capitale —
 * remplace l'énumération séparée par des virgules : une liste de noms collés ne
 * se parcourt pas du regard, et une guirlande de puces colorées fait plus de
 * bruit que de sens. Deux lignes valent mieux qu'une coupée, c'est de
 * l'information.
 *
 * Le **cri** ne dit aujourd'hui que le direct : c'est la seule chose périssable
 * que le registre serve. Le dernier fait d'armes — un succès décroché, un deck
 * publié — demanderait que la recherche le rende, ce qu'elle ne fait pas.
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

  const blazon = [user.city, ...entry.games.map((game) => game.name)]
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
        </p>

        <p className="player-row__meta">
          {t("players.followersCount", { count: entry.followers })}
        </p>

        {entry.isLive && (
          <p className="cry cry--live">
            <span className="live-dot" />
            {t("players.live")}
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
