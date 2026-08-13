/**
 * État de connexion « ressenti » de l'application, au-delà du seul
 * `navigator.onLine`.
 *
 * Un réseau qui met plus de trois secondes à répondre est vécu comme une
 * coupure : l'app sert alors son contenu local et affiche la bannière « hors
 * connexion », sans annuler la requête. Quand celle-ci finit par aboutir — ou
 * quand une requête redevient rapide — la génération change, ce qui fait
 * recharger les écrans montés avec les données fraîches.
 */

/** Délai au-delà duquel une requête est considérée comme trop lente. */
export const SLOW_NETWORK_MS = 3000;

export interface NetworkSnapshot {
  /** Vrai tant que l'app sert son contenu local faute de réseau exploitable. */
  degraded: boolean;
  /** Change à chaque rafraîchissement à faire : dépendance de rechargement. */
  generation: number;
}

let snapshot: NetworkSnapshot = { degraded: false, generation: 0 };
/**
 * Un rafraîchissement a déjà été déclenché depuis le début de l'épisode
 * dégradé. Sans ce garde-fou, sur un réseau durablement lent chaque réponse
 * tardive relancerait un chargement qui répondrait tardivement à son tour :
 * l'app bouclerait indéfiniment sur elle-même.
 */
let refreshedWhileDegraded = false;

const listeners = new Set<() => void>();

function update(next: NetworkSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeNetworkStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Instantané stable, utilisable tel quel par `useSyncExternalStore`. */
export function getNetworkSnapshot(): NetworkSnapshot {
  return snapshot;
}

/** Vrai quand l'app a basculé sur son contenu local. */
export function isNetworkDegraded(): boolean {
  return snapshot.degraded;
}

/**
 * L'app vient de servir son contenu local faute de réponse exploitable — délai
 * dépassé ou requête en échec. C'est ce qui allume la bannière.
 */
export function reportOfflineFallback(): void {
  if (snapshot.degraded) return;
  refreshedWhileDegraded = false;
  update({ ...snapshot, degraded: true });
}

/** Le réseau répond de nouveau normalement : on repasse en ligne. */
function reportNetworkReached(): void {
  if (!snapshot.degraded) return;
  refreshedWhileDegraded = false;
  update({ degraded: false, generation: snapshot.generation + 1 });
}

/**
 * Une requête lente a fini par répondre. Le réseau reste considéré comme
 * mauvais — c'est sa lenteur même qui l'a classé ainsi — mais l'affichage est
 * rafraîchi une fois pour montrer ces données enfin arrivées.
 */
function reportLateResponse(): void {
  if (!snapshot.degraded || refreshedWhileDegraded) return;
  refreshedWhileDegraded = true;
  update({ ...snapshot, generation: snapshot.generation + 1 });
}

/**
 * Demande le rechargement silencieux de tous les écrans montés.
 *
 * La génération n'était jusqu'ici incrémentée que par le réseau, à son retour.
 * Une notification reçue application ouverte est le même événement vu
 * autrement : quelque chose a changé côté serveur, et les listes affichées
 * datent d'avant. Passer par la génération évite d'écrire, écran par écran,
 * un rafraîchissement que `useApi` sait déjà faire.
 */
export function requestRefresh(): void {
  update({ ...snapshot, generation: snapshot.generation + 1 });
}

/**
 * Suit une requête réseau pour en déduire l'état de la connexion, sans en
 * modifier le résultat. C'est la durée qui tranche : une réponse dans les temps
 * signe le retour du réseau, une réponse tardive confirme sa lenteur.
 *
 * Le gestionnaire de rejet évite aussi qu'une requête délaissée au profit du
 * contenu local remonte en rejet non géré.
 */
export function trackNetwork<T>(request: Promise<T>): Promise<T> {
  const startedAt = Date.now();
  request.then(
    () => {
      if (Date.now() - startedAt < SLOW_NETWORK_MS) reportNetworkReached();
      else reportLateResponse();
    },
    // Un échec ne conclut rien sur la vitesse : l'appelant décide quoi en faire.
    () => {},
  );
  return request;
}

/**
 * Sert le contenu de repli si la requête n'a pas répondu dans le délai imparti.
 *
 * Renvoie `null` quand il n'y a pas lieu de basculer : soit le réseau a répondu
 * (ou échoué) à temps, soit aucun contenu local n'est disponible et mieux vaut
 * alors continuer d'attendre la vraie réponse.
 */
export async function staleWhileSlow<T>(
  request: Promise<T>,
  loadStale: () => Promise<T | null>,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = await Promise.race([
    // Réponse comme échec comptent pour « arrivé à temps » : l'appelant a sa
    // propre gestion d'erreur, distincte de la lenteur.
    request.then(
      () => false,
      () => false,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), SLOW_NETWORK_MS);
    }),
  ]);
  clearTimeout(timer);

  if (!timedOut) return null;

  const stale = await loadStale();
  if (stale === null) return null;

  reportOfflineFallback();
  return stale;
}

if (typeof window !== "undefined") {
  // Retour du réseau sans qu'aucune requête ne soit en vol : les écrans servis
  // depuis le contenu local doivent quand même se rafraîchir.
  window.addEventListener("online", () => {
    refreshedWhileDegraded = false;
    update({ degraded: false, generation: snapshot.generation + 1 });
  });
}
