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

type NotificationsPlugin = typeof import("@choochmeque/tauri-plugin-notifications-api");

let pluginModule: Promise<NotificationsPlugin> | null = null;

function loadPlugin(): Promise<NotificationsPlugin> {
  if (!pluginModule) pluginModule = import("@choochmeque/tauri-plugin-notifications-api");
  return pluginModule;
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

    const token = await registerForPushNotifications();
    if (!token) return { status: "unavailable" };

    return { status: "registered", token, platform };
  } catch (error) {
    console.error("Push registration failed", error);
    return { status: "unavailable" };
  }
}

/**
 * Abonne à un événement du plugin et rend de quoi s'en désabonner.
 *
 * L'abonnement est asynchrone : si l'appelant se démonte entre-temps, on
 * annule l'écouteur dès qu'il arrive plutôt que de le laisser courir.
 */
function subscribe(
  register: (plugin: NotificationsPlugin) => Promise<{ unregister: () => Promise<void> }>,
): () => void {
  if (!isTauri()) return () => {};

  let listener: { unregister: () => Promise<void> } | null = null;
  let cancelled = false;

  void loadPlugin()
    .then(async (plugin) => {
      const registered = await register(plugin);
      if (cancelled) {
        void registered.unregister();
        return;
      }
      listener = registered;
    })
    .catch((error) => {
      console.error("Push listener failed", error);
    });

  return () => {
    cancelled = true;
    void listener?.unregister();
  };
}

/**
 * Une notification est arrivée pendant qu'on utilise l'application. Les
 * notifications locales sont écartées : seules celles venues du réseau disent
 * que quelque chose a changé côté serveur.
 */
export function onPushReceived(handler: (payload: PushPayload) => void): () => void {
  return subscribe((plugin) =>
    plugin.onNotificationReceived((notification) => {
      if (notification.source && notification.source !== "push") return;
      handler(readPayload(notification.extra));
    }),
  );
}

/**
 * L'utilisateur a touché une notification. Couvre aussi le démarrage à froid :
 * le plugin garde la notification qui a lancé l'application et la délivre dès
 * qu'un écouteur s'abonne.
 */
export function onPushClicked(handler: (payload: PushPayload) => void): () => void {
  return subscribe((plugin) =>
    plugin.onNotificationClicked((data) => {
      handler(readPayload(data.data));
    }),
  );
}
