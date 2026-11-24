import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { useNetworkStatus } from "./useNetworkStatus";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /**
   * Le code d'erreur de l'API (`code` du corps), quand elle en donne un — par
   * exemple `SUBSCRIPTION` pour une fonctionnalité réservée à un abonnement.
   */
  errorCode: string | null;
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { generation } = useNetworkStatus();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastGeneration = useRef(generation);
  const lastDeps = useRef(deps);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    // Rechargement déclenché par le seul retour du réseau. Si les dépendances
    // ont bougé en même temps, l'écran demande autre chose : on repasse par le
    // chargement normal plutôt que d'afficher les données précédentes comme si
    // elles étaient les bonnes.
    const depsChanged =
      lastDeps.current.length !== deps.length ||
      deps.some((dep, index) => !Object.is(dep, lastDeps.current[index]));
    lastDeps.current = deps;

    const background = !depsChanged && lastGeneration.current !== generation;
    lastGeneration.current = generation;

    // Rafraîchissement silencieux — ni chargement ni erreur affichés, pour
    // remplacer sans clignotement le contenu hors ligne déjà à l'écran. Il
    // suppose justement qu'il y a quelque chose à préserver : sans données
    // affichées, masquer le chargement et l'erreur ne laisserait qu'un écran
    // vide et muet.
    const silent = background && dataRef.current !== null;

    let cancelled = false;
    if (!silent) {
      setLoading(true);
      setError(null);
      setErrorCode(null);
    }
    fnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        dataRef.current = result;
        setData(result);
        setError(null);
        setErrorCode(null);
      })
      .catch((err: unknown) => {
        if (cancelled || silent) return;
        setErrorCode(apiErrorCode(err));
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Une erreur est survenue.",
        );
      })
      .finally(() => {
        // Toujours refermer le chargement : un rendu silencieux qui démarre
        // pendant un chargement initial laisserait sinon l'écran bloqué dessus.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, generation]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, errorCode, reload };
}

/** Le `code` du corps d'une erreur de l'API, s'il y en a un. */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as { code?: unknown } | null | undefined;
  return typeof body?.code === "string" ? body.code : null;
}
