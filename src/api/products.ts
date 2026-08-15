import { api } from "./client";
import { endpoints } from "./endpoints";
import type {
  AddProductResult,
  CollectionProductInput,
  CollectionProductPatch,
  ProductCollectionResult,
  ProductDetail,
} from "./types";

/**
 * Produits d'un jeu de figurines : le catalogue, et les exemplaires possédés.
 *
 * Rien n'est mis en cache ici. Ces écrans modifient la collection, et une
 * réponse gardée en réserve afficherait une possession démentie par la touche
 * précédente — la même règle que pour la collection de cartes.
 */

export interface ProductCatalogParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Gamme ou vague, l'équivalent du `setCode` d'une carte. */
  setCode?: string;
  /**
   * Édition du jeu. **Omise, la route applique celle en cours** : les gammes qui
   * traversent plusieurs éditions ne montrent que la dernière par défaut.
   * `"all"` lève la restriction.
   */
  edition?: string;
  kind?: string;
  /** true = uniquement les produits possédés, false = uniquement les manquants, undefined = tous. */
  owned?: boolean;
  /** true = les produits qui en contiennent d'autres, false = les feuilles. */
  containers?: boolean;
}

/**
 * Catalogue public : consultable sans compte, comme la galerie de cartes, mais
 * sans possession — et sans le filtre par forme, que la route publique ne
 * connaît pas.
 */
export function getGameProducts(
  gameSlug: string,
  params: ProductCatalogParams = {},
): Promise<ProductCollectionResult> {
  return api.get<ProductCollectionResult>(endpoints.games.products(gameSlug), {
    page: params.page,
    limit: params.limit,
    search: params.search,
    setCode: params.setCode,
    edition: params.edition,
    kind: params.kind,
  });
}

/** Le même catalogue, annoté de ce que l'appelant possède (session requise). */
export function getProductCollection(
  gameSlug: string,
  params: ProductCatalogParams = {},
): Promise<ProductCollectionResult> {
  return api.get<ProductCollectionResult>(
    endpoints.collection.gameProducts(gameSlug),
    {
      page: params.page,
      limit: params.limit,
      search: params.search,
      setCode: params.setCode,
      edition: params.edition,
      kind: params.kind,
      owned: params.owned,
      containers: params.containers,
    },
  );
}

/** Fiche d'un produit : contenu résolu, exemplaires possédés, boîtes qui le contiennent. */
export function getProductDetail(
  gameSlug: string,
  productId: string,
): Promise<ProductDetail> {
  return api.get<ProductDetail>(
    endpoints.collection.gameProduct(gameSlug, productId),
  );
}

/**
 * Ajoute un exemplaire et, sauf refus, une entrée par unité de son contenu.
 * Le jeu passe en paramètre de requête : un identifiant de produit n'est unique
 * qu'au sein d'un jeu.
 */
export function addCollectionProduct(
  gameSlug: string,
  input: CollectionProductInput,
): Promise<AddProductResult> {
  return api.post<AddProductResult>(endpoints.collection.products, input, {
    gameSlug,
  });
}

/** Modifie un exemplaire (état de peinture, descellement, détachement…). */
export function updateProductEntry(
  entryId: string,
  patch: CollectionProductPatch,
): Promise<{ success: true }> {
  return api.patch<{ success: true }>(
    endpoints.collection.productEntry(entryId),
    patch,
  );
}

/**
 * Retire un exemplaire. Celui d'un conteneur emporte ce qu'il a apporté et qui
 * y est encore rattaché ; `removed` dit combien d'exemplaires sont partis.
 */
export function removeProductEntry(
  entryId: string,
): Promise<{ success: true; removed: number }> {
  return api.delete<{ success: true; removed: number }>(
    endpoints.collection.productEntry(entryId),
  );
}
