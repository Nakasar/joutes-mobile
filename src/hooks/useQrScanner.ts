import { useCallback, useEffect, useRef, useState } from "react";
import { cancelQrScan, scanQrCode, type QrScanResult } from "../lib/qr-scan";

/**
 * Pilote un scan QR natif : expose l'état d'ouverture (pour afficher la
 * surcouche avec son bouton retour) et branche la navigation retour.
 *
 * Une entrée d'historique est empilée le temps du scan : sur Android le bouton
 * retour matériel déclenche un `goBack()` de la webview, qu'on intercepte donc
 * ici pour refermer la caméra au lieu de quitter l'écran — ou l'application —
 * en laissant l'aperçu caméra affiché.
 */
export function useQrScanner() {
  const [scanning, setScanning] = useState(false);
  const historyEntryRef = useRef(false);

  useEffect(() => {
    function onPopState() {
      // `historyEntryRef` est déjà retombé à false quand c'est nous qui
      // dépilons l'entrée à la fin du scan : rien à annuler dans ce cas.
      if (!historyEntryRef.current) return;
      historyEntryRef.current = false;
      void cancelQrScan();
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Filet de sécurité : un écran démonté pendant un scan ne doit pas
      // laisser la caméra tourner par-dessus le reste de l'application.
      void cancelQrScan();
    };
  }, []);

  const cancel = useCallback(() => void cancelQrScan(), []);

  const start = useCallback(async (): Promise<QrScanResult> => {
    // Sans ça le clavier logiciel du champ « code » resterait ouvert par-dessus
    // l'aperçu caméra.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      return await scanQrCode({
        // La surcouche et l'entrée d'historique n'ont de sens qu'une fois la
        // caméra réellement ouverte, donc après la demande de permission.
        onOpen: () => {
          setScanning(true);
          // L'état de react-router est recopié tel quel (dont son `idx`) : le
          // retour sur cette entrée est alors un POP sans changement de route.
          window.history.pushState({ ...window.history.state, qrScanner: true }, "");
          historyEntryRef.current = true;
        },
      });
    } finally {
      setScanning(false);
      if (historyEntryRef.current) {
        historyEntryRef.current = false;
        window.history.back();
      }
    }
  }, []);

  return { scanning, start, cancel };
}
