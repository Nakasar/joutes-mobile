import { isTauri } from "../api/http";

/**
 * Ouvre le scanner QR natif (plugin `barcode-scanner`, Android/iOS
 * uniquement) et renvoie le contenu décodé (l'URL d'invitation du tournoi),
 * ou `null` si indisponible (hors Tauri), refusé (permission caméra) ou
 * annulé par l'utilisateur.
 */
export async function scanQrCode(): Promise<string | null> {
  if (!isTauri()) return null;
  const { scan, requestPermissions, Format } = await import(
    "@tauri-apps/plugin-barcode-scanner"
  );
  const permission = await requestPermissions();
  if (permission !== "granted") return null;
  try {
    const result = await scan({ windowed: false, formats: [Format.QRCode] });
    return result.content;
  } catch {
    return null;
  }
}
