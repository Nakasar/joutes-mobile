/**
 * Bornes d'un échange — copie de `lib/constants/trade.ts` de joutes-app, où
 * elles sont partagées par le serveur, la validation Zod et l'interface web.
 * Toute modification doit être reportée dans les deux dépôts : c'est le serveur
 * qui tranche, l'application ne fait que s'y conformer d'avance plutôt que de
 * laisser composer une offre qu'il refusera.
 */

/** Nombre maximal de cartes distinctes par face d'un échange. */
export const TRADE_MAX_CARDS_PER_SIDE = 50;

/** Nombre maximal d'exemplaires d'une même carte dans une offre. */
export const TRADE_MAX_QUANTITY = 99;
