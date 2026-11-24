import { api } from "../api/client";
import type { CompanionCard, CompanionGame } from "./state";

/** Un deck du joueur, réduit à ce que le compagnon pose sur la table (voir `GET /companion/decks`). */
export type CompanionDeck = {
  id: string;
  name: string;
  legend?: CompanionCard;
  battlefields?: CompanionCard[];
  leader?: CompanionCard;
  base?: CompanionCard;
  commander?: CompanionCard;
};

/** Les decks du joueur connecté pour ce jeu ; vide sans compte. */
export async function fetchCompanionDecks(game: CompanionGame): Promise<CompanionDeck[]> {
  const data = await api.get<{ decks?: CompanionDeck[] }>("/companion/decks", { game });
  return data.decks ?? [];
}
