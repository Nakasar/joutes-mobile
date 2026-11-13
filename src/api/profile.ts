import { api } from "./client";
import { endpoints } from "./endpoints";

/** Un réglage de notification, tel que la page `/account/notifications` le montre. */
export interface NotificationSetting {
  channel: "emails" | "app" | "discord";
  type: "weekly" | "platform" | "push" | "dm";
  enabled: boolean;
  /** Faux quand il ne peut pas s'ouvrir (Discord sans compte lié). */
  available: boolean;
}

export interface MyProfile {
  displayName?: string;
  discriminator?: string;
  avatar?: string;
  /** L'image déposée par le joueur, s'il en a une. */
  profileImage?: string;
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
    city?: string;
    postalCode?: string;
  };
  notifications: NotificationSetting[];
}

export interface MyProfilePatch {
  displayName?: string;
  /** Adresse rendue par `uploadAvatar`, ou "" pour retirer l'image. */
  profileImage?: string;
  /** `null` retire la localité. */
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
    city?: string;
    postalCode?: string;
  } | null;
  notification?: { channel: string; type: string; enabled: boolean };
}

export function getMyProfile(): Promise<MyProfile> {
  return api.get<{ profile: MyProfile }>(endpoints.users.myProfile).then((r) => r.profile);
}

export function updateMyProfile(patch: MyProfilePatch): Promise<MyProfile> {
  return api.patch<{ profile: MyProfile }>(endpoints.users.myProfile, patch).then((r) => r.profile);
}

/** Dépose un avatar et rend son adresse, à enregistrer ensuite. */
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "avatar");
  const { url } = await api.upload<{ url: string }>(endpoints.users.myUpload, form);
  return url;
}
