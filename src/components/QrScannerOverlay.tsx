import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { BackIcon } from "./icons";

/**
 * Surcouche affichée par-dessus l'aperçu caméra natif pendant un scan QR.
 *
 * Le plugin place la caméra derrière la webview et masque le fond de la page
 * (classe `qr-scanning`) : c'est donc à l'application de fournir le seul moyen
 * de sortir du scan. Rendue dans un portail sur `<body>` pour rester visible
 * alors que le reste de l'app est masqué.
 */
export function QrScannerOverlay({
  title,
  onCancel,
}: {
  title: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return createPortal(
    <div
      className="qr-scanner"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="qr-scanner__head">
        <button
          type="button"
          className="qr-scanner__back"
          onClick={onCancel}
          aria-label={t("common.back")}
        >
          <BackIcon size={20} />
        </button>
        <h2 className="qr-scanner__title">{title}</h2>
      </header>
      <div className="qr-scanner__frame" aria-hidden="true" />
      <div className="qr-scanner__footer">
        <p className="qr-scanner__hint">{t("scanner.hint")}</p>
        <button
          type="button"
          className="btn btn--block qr-scanner__cancel"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
