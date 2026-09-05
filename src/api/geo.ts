import { api } from "./client";
import { endpoints } from "./endpoints";
import type { Place } from "./types";

/**
 * Villes et codes postaux — `GET /geo/places`.
 *
 * Sans cache : chaque frappe est une autre question, et le serveur garde déjà
 * les réponses du géocodeur pour tout le monde. Moins de deux caractères ne
 * partent pas : l'API répondrait une liste vide.
 */
export async function searchPlaces(query: string, lang?: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const response = await api.get<{ places: Place[] }>(endpoints.geo.places, {
    q,
    ...(lang ? { lang } : {}),
  });
  return response.places ?? [];
}
