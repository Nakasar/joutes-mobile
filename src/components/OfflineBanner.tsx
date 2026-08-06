import { useTranslation } from "react-i18next";
import { AlertTriangleIcon } from "./icons";

/**
 * Bandeau « hors connexion », affiché en haut de l'app tant qu'elle sert son
 * contenu local. Il disparaît de lui-même au retour du réseau, en même temps
 * que les écrans se rafraîchissent.
 *
 * `reason` distingue les deux cas : appareil déconnecté, ou appareil connecté
 * mais réseau inexploitable (trop lent, ou en échec). Le second mérite une
 * explication — sans elle, voir « hors connexion » avec toutes les barres de
 * réseau n'a aucun sens.
 */
export function OfflineBanner({
  reason,
}: {
  reason: "disconnected" | "unreachable";
}) {
  const { t } = useTranslation();

  return (
    <div className="offline-banner" role="status">
      <AlertTriangleIcon size={16} />
      <span>{t("network.offlineBanner")}</span>
      {reason === "unreachable" && (
        <span className="offline-banner__detail">
          {t("network.unreachableDetail")}
        </span>
      )}
    </div>
  );
}
