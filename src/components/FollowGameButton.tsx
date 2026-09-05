import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { setFollowingGame } from "../api/users";
import { useAuth } from "../store/auth";
import { CheckIcon, PlusIcon } from "./icons";

/**
 * Suivre un jeu, ou cesser de le suivre.
 *
 * Optimiste : l'état bascule à la touche et revient s'il ne passe pas. Sans
 * session, le bouton mène à la connexion plutôt que de rendre 401.
 */
export function FollowGameButton({
  gameIdOrSlug,
  following,
  onChange,
  variant = "default",
}: {
  gameIdOrSlug: string;
  following: boolean;
  onChange: (following: boolean) => void;
  /** `glass` : posé sur une bannière ; `tile` : une pastille ronde sur une tuile. */
  variant?: "default" | "glass" | "tile";
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !following;
    setBusy(true);
    onChange(next);
    try {
      const state = await setFollowingGame(gameIdOrSlug, next);
      onChange(state.following);
    } catch {
      onChange(following);
    } finally {
      setBusy(false);
    }
  }

  const label = following ? t("games.unfollow") : t("games.follow");

  if (variant === "tile") {
    if (!isAuthenticated) return null;
    return (
      <button
        className={`game-tile__followed game-tile__follow${following ? " game-tile__follow--on" : ""}`}
        disabled={busy}
        onClick={toggle}
        aria-pressed={following}
        aria-label={label}
      >
        {following ? <CheckIcon size={13} /> : <PlusIcon size={13} />}
      </button>
    );
  }

  const className =
    variant === "glass"
      ? `glass-btn${following ? "" : " glass-btn--primary"}`
      : `btn ${following ? "btn--outline" : "btn--grad"} follow-btn`;

  if (!isAuthenticated) {
    return (
      <Link to="/login" className={className}>
        <PlusIcon size={16} />
        {t("games.follow")}
      </Link>
    );
  }

  return (
    <button className={className} disabled={busy} onClick={toggle} aria-pressed={following}>
      {following ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      {following ? t("games.following") : t("games.follow")}
    </button>
  );
}
