import type { SearchField } from "./search-syntax";

/**
 * Champs que seule la collection comprend, comme sur le site
 * (`lib/collection/query.ts`) : le nombre d'exemplaires possédés (`owned<3`),
 * le foil (`foil:yes`) et l'état (`cond:nm`). Le serveur les traduit ; ils ne
 * sont ici que pour les suggestions et les pastilles.
 */
export const COLLECTION_EXTRA_FIELDS: SearchField[] = [
  { key: "owned", kind: "number", min: 0, max: 4 },
  { key: "foil", kind: "value", values: ["yes", "no"] },
  { key: "cond", kind: "value", values: ["damaged", "played", "good", "nm", "mint"] },
];

/** Formats d'échange de collection : Piltover Archive n'existe que pour Riftbound. */
export function collectionFormats(gameSlug: string): Array<{ id: string; label: string }> {
  const joutes = { id: "joutes", label: "Joutes" };
  return gameSlug === "riftbound"
    ? [{ id: "piltover-archive", label: "Piltover Archive" }, joutes]
    : [joutes];
}

/** Le format d'un fichier, d'après ses en-têtes. */
export function detectCollectionFormat(csv: string, gameSlug: string): string {
  const header = csv.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  if (gameSlug === "riftbound" && header.includes("Variant Number")) return "piltover-archive";
  return "joutes";
}
