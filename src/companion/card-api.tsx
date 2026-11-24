import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getCard } from "../api/cards";
import type { CompanionGame } from "./state";

/*
 * Ce que la loupe du compagnon lit d'une carte, et le lien vers sa fiche.
 * Le site a son propre fichier du même nom : le reste de la loupe est
 * recopié tel quel. `getCard` marche aussi hors ligne.
 */

export type LookupErrata = {
  id: string;
  type: "errata" | "clarification" | "ruling";
  details: string;
  translations?: { lang: string; details: string }[];
  source?: string;
  errataDate?: string;
  deprecatedAt?: string | null;
};

export type LookupCard = {
  id: string;
  name: string;
  image?: string;
  orientation?: "portrait" | "landscape";
  erratas: LookupErrata[];
};

/** La fiche d'une carte et ses erratas, clarifications et rulings. */
export async function fetchLookupCard(game: CompanionGame, cardId: string): Promise<LookupCard> {
  const card = await getCard(game, cardId);
  return {
    id: card.id ?? cardId,
    name: card.name ?? "",
    ...(card.image ? { image: card.image } : {}),
    ...(card.orientation === "landscape" || card.orientation === "portrait" ? { orientation: card.orientation } : {}),
    erratas: (card.erratas ?? []) as LookupErrata[],
  };
}

export function formatErrataDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** Vers la fiche complète de la carte ; la partie reste enregistrée. */
export function CardPageLink({ game, cardId, className, children }: { game: CompanionGame; cardId: string; className?: string; children: ReactNode }) {
  return (
    <Link to={`/games/${game}/cards/${encodeURIComponent(cardId)}`} className={className}>
      {children}
    </Link>
  );
}
