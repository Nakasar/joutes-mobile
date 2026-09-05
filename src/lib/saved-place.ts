import type { Place } from "../api/types";

/**
 * « Où êtes-vous ? » — la ville qu'on a dite, et le rayon qu'on regarde.
 *
 * L'application ne lit pas la position de l'appareil : cela demande une
 * permission native qu'elle n'a pas déclarée, et une ville choisie dans une
 * liste dit aussi bien où l'on joue. Le compte du site sait enregistrer sa
 * position, mais l'API ne l'expose pas en écriture : le choix vit donc sur le
 * téléphone, comme la langue.
 *
 * Le rayon appartient à la recherche, pas au lieu de vie — il reste pourtant
 * avec la ville, parce qu'on le règle une fois et qu'on ne veut pas le
 * ressaisir à chaque écran.
 */
export type SavedPlace = Place & { radiusKm: number };

const STORAGE_KEY = "joutes.place";

/** Les rayons proposés, en kilomètres, comme au calendrier du site. */
export const PLACE_RADII = [1, 5, 15, 50, 150] as const;
export const DEFAULT_RADIUS_KM = 15;

/** Le nom de l'événement DOM par lequel un écran apprend que la ville a changé. */
export const PLACE_CHANGED_EVENT = "joutes:place-changed";

export function readSavedPlace(): SavedPlace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedPlace(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSavedPlace(place: SavedPlace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    // Un stockage indisponible : la ville vaut pour cette session seulement.
  }
  notify();
}

export function clearSavedPlace(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Idem.
  }
  notify();
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLACE_CHANGED_EVENT));
}

function isSavedPlace(value: unknown): value is SavedPlace {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.label === "string" &&
    typeof v.latitude === "number" &&
    typeof v.longitude === "number" &&
    typeof v.radiusKm === "number" &&
    v.radiusKm > 0
  );
}

/** Le nom court d'une localité : sa ville, sinon son étiquette entière. */
export function placeName(place: Pick<Place, "label" | "city">): string {
  return place.city ?? place.label;
}

/**
 * La distance à vol d'oiseau entre deux points, en kilomètres (haversine).
 * Assez juste pour dire « à 12 km », ce qui est tout ce qu'on en fait.
 */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** « 850 m » en deçà du kilomètre, « 12 km » au-delà. */
export function formatDistance(km: number, locale: string): string {
  if (km < 1) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(km * 1000)} m`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}
