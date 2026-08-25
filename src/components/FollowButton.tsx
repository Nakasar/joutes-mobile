import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setFollowingUser } from "../api/users";
import { CheckIcon, UserPlusIcon } from "./icons";

/**
 * Suivre un joueur, ou cesser de le suivre.
 *
 * Suivre est **unilatéral** : c'est ce qui le distingue de l'amitié, qui se
 * demande, s'accepte, et ouvre la collection et les parties. D'où l'absence de
 * confirmation — rien n'est demandé à personne.
 *
 * La bascule est optimiste : l'état bascule à la touche, et revient s'il ne
 * passe pas. C'est le geste le plus courant de la vitrine, et le faire attendre
 * un aller-retour pour un compteur donnerait l'impression d'un bouton mort.
 */
export function FollowButton({
  userTagOrId,
  userId,
  following,
  followersCount,
  onChange,
}: {
  userTagOrId: string;
  userId?: string;
  following: boolean;
  followersCount: number;
  onChange: (state: { following: boolean; followersCount: number }) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setBusy(true);

    // Optimiste : on avance le compteur du même pas que l'état, faute de quoi
    // le nombre resterait en arrière d'un aller-retour sous un libellé qui,
    // lui, aurait déjà changé.
    onChange({ following: next, followersCount: followersCount + (next ? 1 : -1) });

    try {
      onChange(await setFollowingUser(userTagOrId, next, userId));
    } catch {
      // Le serveur n'a pas suivi : on revient à ce qu'on savait, plutôt que de
      // laisser un état que rien n'a enregistré.
      onChange({ following, followersCount });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn ${following ? "btn--outline" : "btn--grad"} follow-btn`}
      disabled={busy}
      onClick={toggle}
    >
      {following ? <CheckIcon size={16} /> : <UserPlusIcon size={16} />}
      {following ? t("profile.follow.following") : t("profile.follow.action")}
    </button>
  );
}
