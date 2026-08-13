import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import {
  ensurePushChannel,
  onPushClicked,
  onPushReceived,
  presentPush,
  registerForPush,
} from "../lib/push";
import { registerPushDevice } from "../api/notifications";
import { installationId } from "../lib/installation-id";
import { rememberPushDevice } from "../lib/push-device";
import { notificationDestination } from "../lib/notification-link";
import { requestRefresh } from "../lib/network-status";
import { currentLocale } from "../i18n";

/**
 * Branche l'application sur les notifications push.
 *
 * Monté une fois, dans la coquille : l'enregistrement se fait quand la session
 * est établie, et une seule fois par session. Redemander à chaque montage
 * d'écran ferait réapparaître l'invite du système à des moments incongrus.
 *
 * L'orchestration est séparée de l'appel natif (`src/lib/push.ts`), comme
 * `useQrScanner` l'est de `qr-scan.ts` : le hook connaît React et la
 * navigation, la bibliothèque ne connaît que Tauri.
 */
export function usePushRegistration(): void {
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Le canal Android, déclaré avant tout le reste : une notification adressée à
  // un canal qui n'existe pas encore retombe sur le repli discret de Firebase.
  // Il ne dépend pas de la session — il porte des libellés, pas des données —
  // et se redéclare à chaque changement de langue, ce qui suffit à renommer ce
  // que le téléphone affiche dans ses réglages.
  useEffect(() => {
    void ensurePushChannel({
      name: t("notifications.channelName"),
      description: t("notifications.channelDescription"),
    });
  }, [t]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    let cancelled = false;

    void (async () => {
      const registration = await registerForPush();
      if (cancelled || registration.status !== "registered") return;

      try {
        const device = await registerPushDevice({
          platform: registration.platform,
          token: registration.token,
          installationId: installationId(),
          locale: currentLocale().split("-")[0],
          appVersion: __APP_VERSION__,
        });
        rememberPushDevice(device.id);
      } catch (error) {
        // Un enregistrement raté n'empêche pas d'utiliser l'application : la
        // prochaine ouverture réessaiera.
        console.error("Device registration failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, isAuthenticated]);

  // Une notification touchée déplace l'utilisateur. L'écoute est branchée dès
  // que la session est prête, sans attendre l'enregistrement : le plugin
  // délivre aussi la notification qui a lancé l'application, et la manquer
  // ferait s'ouvrir sur l'accueil quelqu'un qui venait de toucher une alerte.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    return onPushClicked((payload) => {
      navigate(notificationDestination(payload.link));
    });
  }, [ready, isAuthenticated, navigate]);

  // Reçue application ouverte : on ne déplace personne, mais deux choses sont
  // dues. Ce qui est à l'écran date d'avant — la génération suffit à tout
  // recharger. Et l'alerte elle-même n'a été affichée nulle part : Android
  // remet à l'application les notifications poussées qui arrivent au premier
  // plan au lieu de les montrer, si bien qu'un joueur l'écran du tournoi ouvert
  // ne voyait rien passer de son appariement. On la réaffiche donc en local.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    return onPushReceived((push) => {
      requestRefresh();
      void presentPush(push);
    });
  }, [ready, isAuthenticated]);
}
