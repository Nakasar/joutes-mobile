import { isTauri } from "../api/http";

/**
 * L'accès natif aux notifications push.
 *
 * Même patron que `src/lib/qr-scan.ts` : un import dynamique mémoïsé, pour que
 * le build web ne cherche pas un module natif qui n'y existe pas, une garde
 * `isTauri()`, et une issue en union discriminée plutôt qu'une exception —
 * refuser les notifications est un choix de l'utilisateur, pas une erreur.
 *
 * Deux événements distincts, et la distinction compte : `onNotificationReceived`
 * signale une alerte arrivée pendant qu'on utilise l'application,
 * `onNotificationClicked` un utilisateur qui l'a touchée. Seul le second
 * justifie de déplacer quelqu'un — et il couvre aussi le démarrage à froid,
 * quand l'application est lancée *par* la notification.
 */

/**
 * Le canal Android des alertes Joutes.
 *
 * Sans canal déclaré, Android range les notifications poussées dans le canal de
 * repli de Firebase — « Divers », d'importance moyenne, sans bandeau ni son.
 * Une ronde qui s'ouvre mérite mieux que ça, et un canal nommé donne aussi à
 * l'utilisateur de quoi la couper sans couper le reste.
 *
 * L'identifiant est le même côté serveur (`lib/push/payload.ts` de `joutes-app`,
 * `android.notification.channel_id`) : les deux doivent dire la même chaîne,
 * faute de quoi le repli reprend la main sans que rien ne le signale.
 */
export const PUSH_CHANNEL_ID = "joutes-alerts";

type NotificationsPlugin = typeof import("@choochmeque/tauri-plugin-notifications-api");

let pluginModule: Promise<NotificationsPlugin> | null = null;

function loadPlugin(): Promise<NotificationsPlugin> {
  if (!pluginModule) pluginModule = import("@choochmeque/tauri-plugin-notifications-api");
  return pluginModule;
}

type TauriCore = typeof import("@tauri-apps/api/core");

let coreModule: Promise<TauriCore> | null = null;

/** Le cœur de Tauri, chargé de la même façon et pour la même raison. */
function loadCore(): Promise<TauriCore> {
  if (!coreModule) coreModule = import("@tauri-apps/api/core");
  return coreModule;
}

/** Délai au-delà duquel on cesse d'attendre un jeton du système. */
const PUSH_TOKEN_TIMEOUT_MS = 15_000;

/**
 * Rend `null` si la promesse n'a pas abouti dans le délai imparti — un échec
 * comme une attente trop longue valent ici la même chose : pas de jeton.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        console.error("Push token request failed", error);
        resolve(null);
      },
    );
  });
}

export type PushPlatform = "ios" | "android";

export type PushRegistration =
  | { status: "registered"; token: string; platform: PushPlatform }
  /** L'utilisateur a refusé, ou l'avait déjà refusé. */
  | { status: "denied" }
  /** Hors application native, ou plateforme sans push. */
  | { status: "unavailable" };

/** Ce qu'une notification Joutes transporte au-delà de son texte. */
export type PushPayload = {
  notificationId: string | null;
  /** Chemin du site, à traduire par `toMobileRoute` avant d'y mener. */
  link: string | null;
};

/** Une notification poussée, texte compris, telle qu'elle arrive application ouverte. */
export type ReceivedPush = PushPayload & { title: string; body: string };

function currentPlatform(): PushPlatform | null {
  const agent = navigator.userAgent;
  if (/android/i.test(agent)) return "android";
  if (/iphone|ipad|ipod/i.test(agent)) return "ios";
  return null;
}

/**
 * Extrait nos champs de la charge utile.
 *
 * Apple et Google ne les rangent pas au même endroit : le serveur les met sous
 * `joutes` pour APNs et à plat dans `data` pour FCM, et le plugin remonte l'un
 * ou l'autre selon la plateforme. On regarde donc les deux plutôt que de faire
 * dépendre l'application d'un détail d'emballage.
 */
function readPayload(source: Record<string, unknown> | undefined): PushPayload {
  const root = source ?? {};
  const nested = (root.joutes ?? {}) as Record<string, unknown>;

  const pick = (key: string): string | null => {
    const value = nested[key] ?? root[key];
    return typeof value === "string" && value ? value : null;
  };

  return { notificationId: pick("id"), link: pick("link") };
}

/**
 * Demande l'autorisation puis renvoie le jeton de cet appareil.
 *
 * Sur iOS c'est un jeton APNs, sur Android un jeton FCM : le serveur les
 * distingue par la plateforme déclarée, il n'a pas à deviner.
 */
export async function registerForPush(): Promise<PushRegistration> {
  if (!isTauri()) return { status: "unavailable" };

  const platform = currentPlatform();
  if (!platform) return { status: "unavailable" };

  try {
    const { requestPermission, registerForPushNotifications } = await loadPlugin();

    // Sur Android 13 et au-delà, c'est ici que l'invite système apparaît. Un
    // refus antérieur la fait répondre « denied » sans rien afficher : on ne
    // s'acharne pas, le réglage du système reste le dernier mot.
    const permission = await requestPermission();
    if (permission !== "granted") return { status: "denied" };

    // Le plugin se donne dix secondes pour obtenir un jeton, puis abandonne —
    // en théorie seulement : sur iOS il arme ce délai avec un `Timer` posé sur
    // le fil qui lui rend la réponse d'autorisation, un fil sans boucle
    // d'exécution, où le minuteur ne se déclenchera jamais. Un appareil qui
    // n'obtient pas de jeton — pas d'entitlement APNs, réseau absent au
    // lancement — laisserait donc cette promesse en suspens pour de bon. On
    // repose le délai ici, du côté qui l'exécutera pour de vrai.
    const token = await withTimeout(
      registerForPushNotifications(),
      PUSH_TOKEN_TIMEOUT_MS,
    );
    if (!token) return { status: "unavailable" };

    return { status: "registered", token, platform };
  } catch (error) {
    console.error("Push registration failed", error);
    return { status: "unavailable" };
  }
}

/**
 * Déclare le canal des alertes Joutes. Android seulement — ailleurs, un canal
 * n'existe pas et l'appel n'aurait rien à créer.
 *
 * À poser avant que la première notification n'arrive : une notification
 * adressée à un canal inconnu retombe silencieusement sur le repli de Firebase.
 *
 * Rejouer l'appel est sans danger, et pas tout à fait sans effet — la nuance
 * mérite d'être dite, parce qu'elle ne va dans qu'un sens. Android **met à
 * jour** le nom et la description d'un canal existant, mais **fige à la
 * création** ce qui touche à l'alerte : importance, son, vibration. Une fois le
 * canal posé, ces réglages-là appartiennent à l'utilisateur, et c'est voulu :
 * l'application n'a pas à revenir sur ce qu'il a coupé.
 *
 * Les libellés viennent de l'appelant : ils s'affichent dans les réglages du
 * téléphone, et cette bibliothèque ne connaît que Tauri.
 */
export async function ensurePushChannel(labels: {
  name: string;
  description: string;
}): Promise<void> {
  if (!isTauri()) return;
  if (currentPlatform() !== "android") return;

  try {
    const { createChannel, Importance, Visibility } = await loadPlugin();

    await createChannel({
      id: PUSH_CHANNEL_ID,
      name: labels.name,
      description: labels.description,
      // `High` et pas `Default` : c'est ce qui fait apparaître le bandeau et
      // sonner le téléphone. Une ronde qui s'ouvre n'attend pas qu'on déroule
      // le volet des notifications.
      importance: Importance.High,
      visibility: Visibility.Private,
      vibration: true,
      lights: true,
    });
  } catch (error) {
    console.error("Push channel creation failed", error);
  }
}

/**
 * Réaffiche une notification poussée sous forme de notification locale.
 *
 * C'est le trou que ça bouche. Android ne montre **rien** d'une notification
 * poussée quand l'application est au premier plan : Firebase la remet à
 * l'application au lieu de l'afficher, à charge pour elle d'en faire quelque
 * chose. Or c'est exactement la situation d'un joueur qui attend son
 * appariement, l'écran du tournoi ouvert — la notification arrivait dans
 * l'historique et nulle part ailleurs.
 *
 * `extra` reprend les champs du push : Android les repasse tels quels dans
 * l'intention de la notification, si bien qu'un toucher mène au même endroit
 * qu'un toucher depuis le volet système.
 *
 * Android seulement, et pas par symétrie oubliée : sur iOS le plugin ne
 * remonte au clic que les valeurs textuelles de `userInfo`, où il range
 * pourtant `extra` sous forme d'objet. Une notification locale y perdrait sa
 * destination.
 */
export async function presentPush(push: ReceivedPush): Promise<void> {
  if (!isTauri()) return;
  if (currentPlatform() !== "android") return;
  if (!push.title) return;

  try {
    const { sendNotification } = await loadPlugin();

    await sendNotification({
      title: push.title,
      // Un corps vide vaut mieux absent : Android dessine sinon une deuxième
      // ligne blanche sous le titre.
      body: push.body || undefined,
      channelId: PUSH_CHANNEL_ID,
      autoCancel: true,
      extra: { id: push.notificationId ?? "", link: push.link ?? "" },
    });
  } catch (error) {
    console.error("Push presentation failed", error);
  }
}

/** Un retrait d'écouteur qui échoue se signale, il n'interrompt rien. */
function logRemovalFailure(error: unknown): void {
  console.error("Push listener removal failed", error);
}

/**
 * Abonne à un événement du plugin et rend de quoi s'en désabonner.
 *
 * L'abonnement est asynchrone : si l'appelant se démonte entre-temps, on
 * annule l'écouteur dès qu'il arrive plutôt que de le laisser courir.
 */
function subscribe(
  register: () => Promise<{ unregister: () => Promise<void> }>,
): () => void {
  if (!isTauri()) return () => {};

  let listener: { unregister: () => Promise<void> } | null = null;
  let cancelled = false;

  void register()
    .then((registered) => {
      if (cancelled) {
        void registered.unregister().catch(logRemovalFailure);
        return;
      }
      listener = registered;
    })
    .catch((error) => {
      console.error("Push listener failed", error);
    });

  return () => {
    cancelled = true;
    void listener?.unregister().catch(logRemovalFailure);
  };
}

/**
 * Une notification est arrivée pendant qu'on utilise l'application. Les
 * notifications locales sont écartées : seules celles venues du réseau disent
 * que quelque chose a changé côté serveur.
 *
 * Ce filtre porte plus qu'il n'y paraît depuis que `presentPush` réaffiche les
 * poussées en local — sans lui, chaque réaffichage repasserait par ici et
 * s'annoncerait lui-même, indéfiniment.
 */
export function onPushReceived(handler: (push: ReceivedPush) => void): () => void {
  return subscribe(async () => {
    const plugin = await loadPlugin();
    return plugin.onNotificationReceived((notification) => {
      if (notification.source && notification.source !== "push") return;
      handler({
        ...readPayload(notification.extra),
        title: notification.title ?? "",
        body: notification.body ?? "",
      });
    });
  });
}

/** Ce que le natif remonte au toucher d'une notification. */
type NotificationClickedData = { id: number; data?: Record<string, string> };

/**
 * L'utilisateur a touché une notification. Couvre aussi le démarrage à froid :
 * le plugin garde la notification qui a lancé l'application et la délivre dès
 * qu'un écouteur se déclare.
 *
 * L'abonnement est écrit à la main plutôt que confié à `onNotificationClicked`,
 * et c'est tout l'objet de ce détour : l'aide du plugin annonce l'écouteur au
 * natif par sa commande `set_click_listener_active`, qui n'est pas `async`.
 * Tauri exécute ces commandes-là sur le fil principal, où celle-ci attend la
 * réponse de Swift — laquelle commence par remettre le toucher gardé au chaud,
 * par un `Channel` dont l'envoi attend ce même fil principal. Les deux
 * s'attendent : l'application gèle, et justement dans le cas qu'on voulait
 * servir, celui d'une ouverture depuis une notification.
 *
 * `set_push_click_listener_active` (voir `src-tauri/src/lib.rs`) dit la même
 * chose au même endroit, mais en `async` : l'attente quitte le fil principal,
 * qui reste libre de délivrer le toucher.
 */
export function onPushClicked(handler: (payload: PushPayload) => void): () => void {
  // Mobile seulement, et pas par prudence : `set_push_click_listener_active`
  // n'est déclarée que pour les cibles mobiles, et l'application ne pose de
  // notification nulle part ailleurs. Sur un bureau Tauri, où `isTauri()` est
  // vrai aussi, la garde de `subscribe` laisserait partir un appel qui n'a
  // personne au bout.
  if (!isTauri() || currentPlatform() === null) return () => {};

  return subscribe(async () => {
    const { addPluginListener, invoke } = await loadCore();

    const listener = await addPluginListener<NotificationClickedData>(
      "notifications",
      "notificationClicked",
      (clicked) => handler(readPayload(clicked.data)),
    );

    // Après l'écouteur, et non avant : c'est cet appel qui fait remonter un
    // toucher déjà en attente, et il n'aurait alors personne à qui le donner.
    //
    // S'il échoue, on défait l'écouteur ici même : `subscribe` ne recevra pas
    // de quoi le retirer, et il resterait sinon en place pour rien — un de plus
    // à chaque montage.
    try {
      await invoke("set_push_click_listener_active", { active: true });
    } catch (error) {
      await listener.unregister().catch(logRemovalFailure);
      throw error;
    }

    return {
      unregister: async () => {
        // `finally` pour la même raison, dans l'autre sens : le retrait de
        // l'écouteur ne dépend pas de la réussite de l'annonce faite au natif.
        try {
          await invoke("set_push_click_listener_active", { active: false });
        } finally {
          await listener.unregister();
        }
      },
    };
  });
}
