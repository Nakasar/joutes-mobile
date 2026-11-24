import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { MtgCompanion } from "../companion/MtgCompanion";
import { RiftboundCompanion } from "../companion/RiftboundCompanion";
import { SwuCompanion } from "../companion/SwuCompanion";
import { isCompanionGame } from "../companion/state";

const GAME_NAMES = {
  riftbound: "Riftbound",
  swu: "Star Wars: Unlimited",
  mtg: "Magic: The Gathering",
} as const;

/**
 * Le compagnon de partie d'un jeu, comme `/games/<jeu>/companion` sur le site :
 * mêmes écrans, mêmes thèmes, et la partie reste sur l'appareil.
 */
export function CompanionScreen() {
  const { gameSlug } = useParams();
  const { t } = useTranslation();
  if (!isCompanionGame(gameSlug)) return <Navigate to={gameSlug ? `/games/${gameSlug}` : "/games"} replace />;

  return (
    <div className="screen companion-screen">
      <BackHeader title={t("companion.title")} />
      <p className="screen-subtitle">
        {GAME_NAMES[gameSlug]} · {t("companion.description")}
      </p>
      {gameSlug === "riftbound" && <RiftboundCompanion />}
      {gameSlug === "swu" && <SwuCompanion />}
      {gameSlug === "mtg" && <MtgCompanion />}
    </div>
  );
}
