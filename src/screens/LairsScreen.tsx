import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { LairsList } from "../components/LairsList";

/** L'annuaire des lieux, en écran plein. Le contenu vit dans `LairsList`, que
 *  l'onglet « Boutiques » de la Communauté sert aussi. */
export function LairsScreen() {
  const { t } = useTranslation();

  return (
    <div className="screen">
      <BackHeader title={t("lairs.title")} />
      <LairsList />
    </div>
  );
}
