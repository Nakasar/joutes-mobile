import { useEffect, useState } from "react";
import { searchCards } from "../api/cards";
import { buildSearchFields, type SearchField } from "../lib/search-syntax";

/** Un seul appel par jeu : plusieurs écrans d'une même session le partagent. */
const cache = new Map<string, Promise<SearchField[]>>();

function loadFields(gameSlug: string, extra: SearchField[]): Promise<SearchField[]> {
  const key = `${gameSlug}|${extra.map((field) => field.key).join(",")}`;
  let pending = cache.get(key);
  if (!pending) {
    // Une recherche d'une carte suffit : la réponse porte les facettes et les
    // listes du jeu, d'où la syntaxe tire son vocabulaire. Hors ligne, l'export
    // téléchargé fournit au moins les extensions et les types.
    pending = searchCards(gameSlug, { page: 1, limit: 1 })
      .then((data) =>
        buildSearchFields(
          data.facets ?? [],
          { setCodes: data.setCodes ?? [], types: data.types ?? [], languages: data.languages ?? [] },
          extra,
        ),
      )
      .catch(() => {
        cache.delete(key);
        return [];
      });
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Le vocabulaire de la barre de recherche de cartes d'un jeu (`domain:fury`,
 * `energy<=3`, `set:OGN`…). Vide tant qu'il n'est pas arrivé : la saisie
 * fonctionne quand même, le serveur relisant lui-même les tokens ; seules les
 * suggestions attendent. `extra` ajoute des champs propres à un écran
 * (`owned`, `foil`, `cond` dans la collection) ; il doit être stable.
 */
export function useCardSearchFields(
  gameSlug: string | undefined,
  extra: SearchField[] = NO_EXTRA,
): SearchField[] {
  const [fields, setFields] = useState<SearchField[]>([]);
  useEffect(() => {
    if (!gameSlug) return;
    let cancelled = false;
    void loadFields(gameSlug, extra).then((next) => !cancelled && setFields(next));
    return () => {
      cancelled = true;
    };
  }, [gameSlug, extra]);
  return fields;
}

const NO_EXTRA: SearchField[] = [];
