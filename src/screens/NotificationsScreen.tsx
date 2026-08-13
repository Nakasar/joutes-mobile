import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BackHeader } from "../components/BackHeader";
import { StatusView } from "../components/StatusView";
import { BellIcon, TrashIcon } from "../components/icons";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import {
  hideNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications";
import type { JoutesNotification } from "../api/types";
import { toMobileRoute } from "../lib/notification-link";
import { formatDeadline } from "../lib/tournament-deadline";
import { currentLocale } from "../i18n";

/**
 * Le centre de notifications.
 *
 * Il existe parce qu'un push manqué doit rester consultable : une alerte
 * balayée de l'écran de verrouillage ne laisse aucune trace sur le téléphone,
 * et l'application n'avait jusqu'ici aucun endroit où la retrouver.
 */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ready, isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  // Les changements d'état se voient tout de suite, sans attendre un
  // rechargement complet de la liste.
  const [read, setRead] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);

  const load = useCallback(() => listNotifications(page), [page]);
  const { data, loading, error, reload } = useApi(load, [page]);

  // `useApi` remplace ses données à chaque page ; on garde les précédentes pour
  // que « charger plus » allonge la liste au lieu de la remplacer.
  const [loaded, setLoaded] = useState<JoutesNotification[]>([]);
  useEffect(() => {
    if (!data) return;
    setLoaded((current) =>
      data.page === 1
        ? data.notifications
        : [
            ...current,
            ...data.notifications.filter(
              (notification) => !current.some((seen) => seen.id === notification.id),
            ),
          ],
    );
  }, [data]);

  async function open(notification: JoutesNotification) {
    setRead((current) => [...current, notification.id]);
    void markNotificationRead(notification.id).catch(() => {});

    const route = toMobileRoute(notification.link);
    if (route) navigate(route);
  }

  async function dismiss(notification: JoutesNotification) {
    setHidden((current) => [...current, notification.id]);
    try {
      await hideNotification(notification.id);
    } catch {
      // L'appel a échoué : la notification est toujours là, on la remontre
      // plutôt que de laisser croire qu'elle a disparu.
      setHidden((current) => current.filter((id) => id !== notification.id));
    }
  }

  async function readAll() {
    const ids = loaded.map((notification) => notification.id);
    setRead((current) => [...current, ...ids]);
    try {
      await markAllNotificationsRead();
    } catch {
      reload();
    }
  }

  if (ready && !isAuthenticated) {
    return (
      <div className="screen">
        <BackHeader title={t("notifications.title")} />
        <section className="card">
          <p className="muted">{t("notifications.signedOut")}</p>
        </section>
      </div>
    );
  }

  const visible = loaded.filter(
    (notification) => !hidden.includes(notification.id),
  );
  const hasUnread = visible.some(
    (notification) => !notification.read && !read.includes(notification.id),
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="screen">
      <BackHeader title={t("notifications.title")} />

      {hasUnread && (
        <div className="notifications__actions">
          <button className="btn btn--ghost" onClick={readAll}>
            {t("notifications.markAllRead")}
          </button>
        </div>
      )}

      <StatusView
        loading={loading && !data}
        error={error}
        onRetry={reload}
        empty={visible.length === 0 && !loading ? t("notifications.empty") : undefined}
      />

      {visible.map((notification) => {
        const unread = !notification.read && !read.includes(notification.id);
        const when = formatDeadline(notification.createdAt, currentLocale());
        const target = toMobileRoute(notification.link);

        return (
          <section
            key={notification.id}
            className={`card notification${unread ? " notification--unread" : ""}`}
          >
            <div className="notification__body">
              <span className="notification__icon">
                <BellIcon size={20} />
              </span>
              <button
                type="button"
                className="notification__text"
                onClick={() => open(notification)}
                // Sans destination, le bouton ne fait que marquer comme lu :
                // on le dit plutôt que de laisser attendre une navigation.
                aria-label={
                  target ? t("notifications.open") : t("notifications.markRead")
                }
              >
                <p className="notification__title">{notification.title}</p>
                <p className="notification__description">{notification.description}</p>
                <p className="notification__meta">{when}</p>
              </button>
              <button
                type="button"
                className="notification__dismiss"
                onClick={() => dismiss(notification)}
                aria-label={t("notifications.dismiss")}
              >
                <TrashIcon size={18} />
              </button>
            </div>
          </section>
        );
      })}

      {!loading && !error && page < totalPages && (
        <button
          className="btn btn--grad load-more"
          onClick={() => setPage((current) => current + 1)}
        >
          {t("notifications.loadMore")}
        </button>
      )}
    </div>
  );
}
