import { deletePushDevice, listPushDevices } from "../api/notifications";
import { installationId } from "./installation-id";

const STORAGE_KEY = "joutes.push-device-id";

/**
 * Le lien entre cette installation et l'appareil enregistré côté serveur.
 *
 * Le serveur identifie un appareil par son identifiant à lui, que l'application
 * ne connaît qu'au moment de l'enregistrement. Le retenir évite d'avoir à
 * relister les appareils pour retrouver le sien au moment de se déconnecter —
 * moment où le réseau est justement le moins fiable, et où une requête de plus
 * retarde une action que l'utilisateur attend.
 */
export function rememberPushDevice(deviceId: string): void {
  localStorage.setItem(STORAGE_KEY, deviceId);
}

export function forgetPushDevice(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Retire cet appareil du compte courant.
 *
 * Appelé à la déconnexion, **avant** la fermeture de session. Ne lève jamais :
 * un utilisateur qui se déconnecte doit se déconnecter, même hors réseau. Le
 * pire cas — un appareil qui reste enregistré — se rattrape depuis la page des
 * notifications du site, et le premier envoi vers un jeton devenu invalide le
 * supprimera de toute façon.
 */
export async function revokeThisDevice(): Promise<void> {
  const deviceId = localStorage.getItem(STORAGE_KEY);

  try {
    if (deviceId) {
      await deletePushDevice(deviceId);
    } else {
      // Rien de mémorisé : c'est le cas d'une mise à jour depuis une version
      // qui ne retenait pas encore l'identifiant serveur. L'installation, elle,
      // a survécu — on retrouve l'appareil par elle.
      //
      // Un stockage réellement vidé, lui, échappe à ce rattrapage :
      // `installationId()` en produit un nouveau, qui ne correspond plus à rien.
      // L'appareil restera enregistré jusqu'à ce que son jeton devienne
      // invalide, ce que le premier envoi constatera.
      const mine = installationId();
      const devices = await listPushDevices();
      await Promise.all(
        devices
          .filter((device) => device.state === "active" && device.installationId === mine)
          .map((device) => deletePushDevice(device.id)),
      );
    }
  } catch {
    // Hors réseau, session déjà expirée : la déconnexion prime.
  } finally {
    forgetPushDevice();
  }
}
