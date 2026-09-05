import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Un état d'écran porté par l'URL : l'onglet ouvert, la pastille choisie.
 *
 * Un `useState` meurt avec l'écran. Or l'écran meurt à chaque navigation :
 * ouvrir une partie depuis l'onglet « Parties » puis revenir remontait
 * « Jouer » sur son onglet par défaut, et l'utilisateur retrouvait l'autre
 * liste. L'entrée d'historique, elle, survit — c'est donc à elle de porter le
 * choix. `navigate(-1)` rend l'URL entière, paramètres compris.
 *
 * L'écriture remplace l'entrée courante plutôt que d'en empiler une : changer
 * d'onglet n'est pas une navigation, et « retour » doit quitter l'écran, pas
 * le faire défiler d'onglet en onglet. Les autres paramètres sont conservés,
 * et la valeur par défaut retire le sien — l'URL reste celle du lien.
 */
export function useSearchParam(
  name: string,
): [string | null, (next: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name);

  const setValue = useCallback(
    (next: string | null) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === null) params.delete(name);
          else params.set(name, next);
          return params;
        },
        { replace: true },
      );
    },
    [name, setSearchParams],
  );

  return [value, setValue];
}

/**
 * La même chose, ramenée à une liste fermée de valeurs : ce que l'URL porte
 * d'inconnu — un lien ancien, une faute de frappe — retombe sur le défaut.
 */
export function useSearchParamState<K extends string>(
  name: string,
  allowed: readonly K[],
  fallback: K,
): [K, (next: K) => void] {
  const [raw, setRaw] = useSearchParam(name);
  const value = allowed.includes(raw as K) ? (raw as K) : fallback;

  const setValue = useCallback(
    (next: K) => setRaw(next === fallback ? null : next),
    [fallback, setRaw],
  );

  return [value, setValue];
}
