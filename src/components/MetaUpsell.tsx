import { useTranslation } from "react-i18next";

/**
 * Ce que montrent les écrans de la méta à qui n'est pas abonné Joutes Expert :
 * le site refuse leurs données (403, code `SUBSCRIPTION`). Pas de lien d'achat
 * dans l'app : les boutiques d'applications l'encadrent, l'abonnement se prend
 * sur joutes.app.
 */
export function MetaUpsell({ group = false }: { group?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="meta-upsell">
      <b>{t("meta.upsell.title")}</b>
      <p className="muted">{t(group ? "meta.upsell.groupBody" : "meta.upsell.body")}</p>
    </div>
  );
}
