import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { useNetworkStatus } from "./useNetworkStatus";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Petit hook de chargement de données : exécute `fn` au montage et à chaque
 * changement de `deps`, en ignorant les réponses obsolètes.
 *
 * Se recharge aussi au retour du réseau (`generation`) : les écrans affichés
 * depuis le contenu hors ligne — parce que le réseau était coupé ou trop lent —
 * repassent ainsi d'eux-mêmes sur les données fraîches.
 */
export function useApi<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { generation } = useNetworkStatus();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastGeneration = useRef(generation);
  const lastDeps = useRef(deps);

  useEffect(() => {
    // Rechargement déclenché par le seul retour du réseau : il se fait en
    // arrière-plan, sans repasser par l'état de chargement, pour que le contenu
    // hors ligne déjà affiché soit remplacé sans clignotement. Si les
    // dépendances ont bougé en même temps, l'écran demande autre chose : on
    // repasse par le chargement normal plutôt que d'afficher les données
    // précédentes comme si elles étaient les bonnes.
    const depsChanged =
      lastDeps.current.length !== deps.length ||
      deps.some((dep, index) => !Object.is(dep, lastDeps.current[index]));
    lastDeps.current = deps;

    const background = !depsChanged && lastGeneration.current !== generation;
    lastGeneration.current = generation;

    let cancelled = false;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    fnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        // Un rafraîchissement en arrière-plan qui échoue ne doit pas remplacer
        // par une erreur ce que l'écran affiche déjà : la bannière hors
        // connexion suffit à expliquer la situation.
        if (cancelled || background) return;
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Une erreur est survenue.",
        );
      })
      .finally(() => {
        if (!cancelled && !background) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, generation]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload };
}
