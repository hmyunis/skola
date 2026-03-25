import { apiFetch } from "./api";

export interface NotificationSettings {
  inAppAnnouncements: boolean;
  browserPushAnnouncements: boolean;
  botDmAnnouncements: boolean;
}

export interface InAppNotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

export interface InAppNotificationListResponse {
  unreadCount: number;
  items: InAppNotificationItem[];
}

export interface WebPushClientConfig {
  configured: boolean;
  publicKey: string | null;
}

export type NotificationTestType = "announcement" | "mention";

export interface NotificationTestResponse {
  type: NotificationTestType;
  inApp: "sent" | "skipped_disabled";
  browserPush:
    | "sent"
    | "skipped_disabled"
    | "skipped_unconfigured"
    | "skipped_unsubscribed";
  botDm:
    | "sent"
    | "skipped_disabled"
    | "skipped_unconfigured"
    | "skipped_missing_telegram";
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  return apiFetch("/notifications/settings");
}

export async function saveNotificationSettings(
  payload: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  return apiFetch("/notifications/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchInAppNotifications(
  limit = 30,
): Promise<InAppNotificationListResponse> {
  return apiFetch(`/notifications/in-app?limit=${Math.max(1, Math.min(100, limit))}`);
}

export async function markInAppNotificationRead(id: string): Promise<{ success: true }> {
  return apiFetch(`/notifications/in-app/${id}/read`, {
    method: "POST",
  });
}

export async function dismissInAppNotification(id: string): Promise<{ success: true }> {
  return apiFetch(`/notifications/in-app/${id}`, {
    method: "DELETE",
  });
}

export async function markAllInAppNotificationsRead(): Promise<{ success: true }> {
  return apiFetch("/notifications/in-app/read-all", {
    method: "POST",
  });
}

export async function fetchWebPushConfig(): Promise<WebPushClientConfig> {
  return apiFetch("/notifications/push/config");
}

export async function subscribeWebPush(payload: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  userAgent?: string;
}): Promise<{ success: true }> {
  return apiFetch("/notifications/push/subscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unsubscribeWebPush(endpoint: string): Promise<{ success: true }> {
  return apiFetch("/notifications/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendTestNotification(
  type: NotificationTestType,
): Promise<NotificationTestResponse> {
  return apiFetch("/notifications/test", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}
