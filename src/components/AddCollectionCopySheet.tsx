import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CollectionItem } from "../api/types";
import { resolvePrinting, type PrintingChoice } from "../lib/printings";
import { PrintingPicker } from "./PrintingPicker";

/**
 * Choix de la variante d'impression avant d'ajouter un exemplaire à la
 * collection. N'est ouverte que pour les cartes qui ont des variantes : sans
 * variante, l'ajout reste direct depuis la vignette.
 *
 * La variante décide du foil : en choisir une imprimée en foil enregistre
 * l'exemplaire en foil, comme une carte qui n'existe qu'en foil.
 */
export function AddCollectionCopySheet({
  item,
  onClose,
  onConfirm,
}: {
  item: CollectionItem;
  onClose: () => void;
  onConfirm: (choice: PrintingChoice) => void;
}) {
  const { t } = useTranslation();
  const [printingId, setPrintingId] = useState("");
  const choice = resolvePrinting(item, printingId || undefined);
  const image = choice.image ?? item.image;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        <div className="sheet__body form-sheet">
          <h2 className="form-sheet__title">
            {t("collection.browse.addCopyTitle")}
          </h2>

          <div className="list-row">
            {image ? (
              <span
                className={`thumb-frame${choice.foil ? " foil-shine" : ""}`}
              >
                <img src={image} alt="" className="list-row__thumb" />
              </span>
            ) : (
              <span className="list-row__thumb" />
            )}
            <div className="list-row__body">
              <p className="list-row__title">{item.name}</p>
              <p className="list-row__sub">
                {item.setCode} {item.collectorNumber}
              </p>
              <div className="copy-badges">
                {choice.foil && (
                  <span className="chip chip--accent">{t("printings.foil")}</span>
                )}
                {choice.printingName && (
                  <span className="chip">{choice.printingName}</span>
                )}
              </div>
            </div>
          </div>

          <PrintingPicker
            printings={item.printings}
            value={printingId}
            onChange={setPrintingId}
            id={`collection-printing-${item.id}`}
          />

          <button
            className="btn btn--grad btn--block"
            onClick={() => onConfirm(choice)}
          >
            {t("collection.browse.addCopySubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
