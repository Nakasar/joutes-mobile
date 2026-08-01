import { useTranslation } from "react-i18next";
import type { CardPrinting } from "../api/types";

/**
 * Choix de la variante d'impression d'une carte, partagé par tous les écrans
 * qui enregistrent un exemplaire (collection, liste de souhaits). N'affiche
 * rien quand la carte n'a pas de variante : la version de base est alors le
 * seul choix possible.
 */
export function PrintingPicker({
  printings,
  value,
  onChange,
  id = "printing",
}: {
  printings?: CardPrinting[];
  /** Identifiant de la variante choisie ; vide = version de base. */
  value: string;
  onChange: (printingId: string) => void;
  id?: string;
}) {
  const { t } = useTranslation();

  if (!printings || printings.length === 0) {
    return null;
  }

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{t("printings.label")}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">{t("printings.base")}</option>
        {printings.map((printing) => (
          <option key={printing.id} value={printing.id}>
            {printing.foil
              ? t("printings.foilOption", { name: printing.name })
              : printing.name}
          </option>
        ))}
      </select>
    </label>
  );
}
