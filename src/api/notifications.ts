import { api } from "./client";
import { endpoints } from "./endpoints";
import type { JoutesNotification, NotificationsPage, PushDeviceSummary } from "./types";
import type { PushPlatform } from "../lib/push";

/**
 * Le centre de notifications, et les appareils qui les reçoivent.
 *
 * Rien n'est mis en cache ici, à dessein : `withCache` sert les écrans qu'on
 * veut pouvoir consulter hors ligne, et une liste de notifications périmée
 * dirait le contraire de ce qu'elle prétend — que tout est lu, ou qu'il ne
 * s'est rien passé.
 */

export function listNotifications(page = 1, limit = 20): Promise<NotificationsPage> {
  return api.get<NotificationsPage>(endpoints.notifications.list, { page, limit });
}

export function getUnreadCount(): Promise<number> {
  return api
    .get<{ count: number }>(endpoints.notifications.unreadCount)
    .then((response) => response.count ?? 0);
}

export function markNotificationRead(notificationId: string): Promise<void> {
  return api.post(endpoints.notifications.read(notificationId)).then(() => undefined);
}

export function markAllNotificationsRead(): Promise<void> {
  return api.post(endpoints.notifications.readAll).then(() => undefined);
}

export function hideNotification(notificationId: string): Promise<void> {
  return api.post(endpoints.notifications.hide(notificationId)).then(() => undefined);
}

export function registerPushDevice(device: {
  platform: PushPlatform;
  token: string;
  installationId: string;
  environment?: "production" | "sandbox";
  locale?: string;
  appVersion?: string;
}): Promise<PushDeviceSummary> {
  return api
    .post<{ device: PushDeviceSummary }>(endpoints.notifications.devices, device)
    .then((response) => response.device);
}

export function listPushDevices(): Promise<PushDeviceSummary[]> {
  return api
    .get<{ devices: PushDeviceSummary[] }>(endpoints.notifications.devices)
    .then((response) => response.devices ?? []);
}

export function deletePushDevice(deviceId: string): Promise<void> {
  return api.delete(endpoints.notifications.device(deviceId)).then(() => undefined);
}

export type { JoutesNotification };
