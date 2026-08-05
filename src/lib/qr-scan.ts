import { isTauri } from "../api/http";

type BarcodeScanner = typeof import("@tauri-apps/plugin-barcode-scanner");

let scannerModule: Promise<BarcodeScanner> | null = null;

function loadScanner(): Promise<BarcodeScanner> {
  if (!scannerModule) scannerModule = import("@tauri-apps/plugin-barcode-scanner");
  return scannerModule;
}

/**
 * Classe posée sur `<html>` pendant un scan. Le plugin natif rend la webview
 * transparente et place l'aperçu caméra derrière (option `windowed`) : encore
 * faut-il que la page, elle aussi, laisse passer la caméra.
 */
const SCANNING_CLASS = "qr-scanning";

export type QrScanResult =
  | { status: "scanned"; content: string }
  | { status: "cancelled" }
  | { status: "unavailable" };

/** Résolveur du scan en cours, utilisé par `cancelQrScan()`. */
let finishCurrentScan: ((result: QrScanResult) => void) | null = null;

function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("cancel");
}

/**
 * Ouvre le scanner QR natif (plugin `barcode-scanner`, Android/iOS uniquement)
 * et renvoie le contenu décodé (l'URL d'invitation), ou l'issue du scan :
 * `cancelled` si l'utilisateur est ressorti de la caméra, `unavailable` hors
 * Tauri ou si la permission caméra est refusée.
 *
 * L'aperçu caméra est ouvert en mode `windowed` : la webview passe au premier
 * plan, ce qui permet d'afficher notre propre en-tête de scan (bouton retour).
 * Sans ça la caméra recouvre toute l'interface et le scan ne peut plus être
 * quitté autrement qu'en fermant l'application.
 */
export async function scanQrCode(options?: {
  /** Appelé quand l'aperçu caméra s'ouvre réellement (après la permission). */
  onOpen?: () => void;
}): Promise<QrScanResult> {
  if (!isTauri()) return { status: "unavailable" };

  let finish: (result: QrScanResult) => void = () => {};
  const outcome = new Promise<QrScanResult>((resolve) => {
    finish = resolve;
  });

  try {
    const { scan, requestPermissions, Format } = await loadScanner();
    const permission = await requestPermissions();
    if (permission !== "granted") return { status: "unavailable" };

    finishCurrentScan = finish;
    document.documentElement.classList.add(SCANNING_CLASS);
    options?.onOpen?.();

    scan({ windowed: true, formats: [Format.QRCode] }).then(
      (result) => finish({ status: "scanned", content: result.content }),
      (error: unknown) => {
        if (isCancellation(error)) {
          finish({ status: "cancelled" });
          return;
        }
        console.error("QR scan failed", error);
        finish({ status: "unavailable" });
      },
    );

    return await outcome;
  } catch (error) {
    console.error("QR scan failed", error);
    return { status: "unavailable" };
  } finally {
    finishCurrentScan = null;
    document.documentElement.classList.remove(SCANNING_CLASS);
  }
}

/**
 * Ferme l'aperçu caméra du scan en cours (bouton retour ou retour matériel).
 * Sans effet si aucun scan n'est ouvert.
 */
export async function cancelQrScan(): Promise<void> {
  const finish = finishCurrentScan;
  if (!finish) return;
  finishCurrentScan = null;
  try {
    const { cancel } = await loadScanner();
    await cancel();
  } catch (error) {
    console.error("QR scan cancel failed", error);
  } finally {
    // Sur Android, `cancel()` démonte la caméra sans jamais rejeter la promesse
    // de `scan()` : on débloque nous-mêmes l'appelant pour ne pas rester coincé.
    finish({ status: "cancelled" });
  }
}
