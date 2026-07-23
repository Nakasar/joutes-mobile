import { isTauri } from "../api/http";

/**
 * Ouvre le scanner QR natif (plugin `barcode-scanner`, Android/iOS
 * uniquement) et renvoie le contenu décodé (l'URL d'invitation du tournoi),
 * ou `null` si indisponible (hors Tauri), refusé (permission caméra) ou
 * annulé par l'utilisateur.
 */
export async function scanQrCode(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { scan, requestPermissions, Format } = await import(
      "@tauri-apps/plugin-barcode-scanner"
    );
    const permission = await requestPermissions();
    if (permission !== "granted") return null;
    const result = await scan({ windowed: false, formats: [Format.QRCode] });
    return result.content;
  } catch (error) {
    // Annulation utilisateur ou échec de scan : on log pour le diagnostic,
    // l'appelant se contente d'un retour à la saisie manuelle du code.
    console.error("QR scan failed", error);
    return null;
  }
}
