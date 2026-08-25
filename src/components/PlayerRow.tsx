import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RegistryEntry } from "../api/types";
import { colorFor, initialOf, tintStyle } from "../lib/game-visuals";
import { userLabel, userProfilePath } from "../lib/user-tag";
import { CachedImage } from "./CachedImage";
import { ChevronIcon, UsersIcon } from "./icons";

/**
 * Une fiche du registre : de quoi reconnaître un joueur et décider de l'ouvrir.
 *
 * Les jeux qu'il suit sont la seule chose qui distingue vraiment deux comptes
 * dans une liste, d'où leur place au sous-titre. La pastille « en direct » passe
 * devant le reste : c'est périssable, et c'est ce qu'on vient chercher quand on
 * filtre dessus.
 */
export function PlayerRow({ entry }: { entry: RegistryEntry }) {
  const { t } = useTranslation();
  const { user } = entry;
  const label = userLabel(user);

  const subtitle = [
    entry.games.map((game) => game.name).join(", "),
    user.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link to={userProfilePath(user)} className="list-row list-row--link">
      {user.avatar ? (
        <CachedImage src={user.avatar} alt="" className="avatar" />
      ) : (
        <span className="avatar" style={tintStyle(colorFor(user.id))}>
          {initialOf(label)}
        </span>
      )}
      <div className="list-row__body">
        <p className="list-row__title">
          {label}
          {entry.isLive && <span className="live-dot" aria-label={t("players.live")} />}
        </p>
        <p className="list-row__sub">{subtitle || t("players.noGames")}</p>
      </div>
      {entry.followers > 0 && (
        <span className="chip">
          <UsersIcon size={13} />
          {entry.followers}
        </span>
      )}
      <span className="chevron">
        <ChevronIcon size={18} />
      </span>
    </Link>
  );
}
