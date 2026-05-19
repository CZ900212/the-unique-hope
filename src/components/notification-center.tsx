"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { useI18n } from "~/components/locale-provider";
import { formatAppDateTime } from "~/lib/date-format";
import { api, type RouterOutputs } from "~/trpc/react";

type NotificationItem =
  RouterOutputs["notifications"]["list"]["notifications"][number];

export function NotificationCenter() {
  const { locale, messages } = useI18n();
  const utils = api.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [browserStatus, setBrowserStatus] = useState<
    | "blocked"
    | "enabled"
    | "idle"
    | "not_configured"
    | "save_failed"
    | "unsupported"
  >("idle");
  const latestNativeNotificationId = useRef<string | null>(null);
  const notificationQuery = api.notifications.list.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const markRead = api.notifications.markRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.list.invalidate();
      await utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = api.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      await utils.notifications.list.invalidate();
      await utils.notifications.unreadCount.invalidate();
    },
  });
  const saveBrowserSubscription =
    api.notifications.saveBrowserSubscription.useMutation();

  const notifications = notificationQuery.data?.notifications ?? [];
  const unreadCount = notificationQuery.data?.unreadCount ?? 0;
  const latestUnread = notifications.find(
    (notification) => !notification.readAt,
  );

  useEffect(() => {
    if (!latestUnread) return;

    if (latestNativeNotificationId.current === null) {
      latestNativeNotificationId.current = latestUnread.id;
      return;
    }

    if (latestNativeNotificationId.current === latestUnread.id) return;
    latestNativeNotificationId.current = latestUnread.id;

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(notificationTitle(latestUnread, locale), {
        body: notificationBody(latestUnread, locale),
      });
    } catch {
      // Browser notifications are optional; the saved in-app notification remains available.
    }
  }, [latestUnread, locale]);

  async function enableBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserStatus("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setBrowserStatus("blocked");
      return;
    }

    const publicKey = notificationQuery.data?.browserPushPublicKey;
    if (!publicKey) {
      setBrowserStatus("not_configured");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setBrowserStatus("unsupported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(
        "/notification-sw.js",
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(publicKey),
          userVisibleOnly: true,
        }));
      const payload = subscription.toJSON();
      if (payload.endpoint && payload.keys?.auth && payload.keys.p256dh) {
        await saveBrowserSubscription.mutateAsync({
          endpoint: payload.endpoint,
          expirationTime: payload.expirationTime ?? null,
          keys: {
            auth: payload.keys.auth,
            p256dh: payload.keys.p256dh,
          },
        });
        setBrowserStatus("enabled");
        return;
      }
      setBrowserStatus("save_failed");
    } catch {
      setBrowserStatus("save_failed");
    }
  }

  function openNotification(notification: NotificationItem) {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
    if (notification.href) {
      window.location.assign(notification.href);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={messages.notifications.title}
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--card-border)] bg-white text-[var(--color-text-main)] transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-[var(--status-error)] px-1.5 py-0.5 text-center text-[0.65rem] leading-none font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-white shadow-[var(--card-shadow-md)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
            <div>
              <div className="text-sm font-bold text-[var(--color-text-main)]">
                {messages.notifications.title}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {messages.notifications.unread.replace(
                  "{count}",
                  String(unreadCount),
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
            >
              {messages.notifications.markAllRead}
            </button>
          </div>

          <div className="border-b border-[var(--card-border)] px-4 py-3">
            <button
              type="button"
              disabled={saveBrowserSubscription.isPending}
              onClick={enableBrowserNotifications}
              className="btn-secondary px-3 py-2 text-xs disabled:opacity-50"
            >
              {browserStatus === "enabled"
                ? messages.notifications.browserEnabled
                : messages.notifications.enableBrowser}
            </button>
            {browserStatus === "unsupported" ? (
              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {messages.notifications.browserUnsupported}
              </div>
            ) : null}
            {browserStatus === "blocked" ? (
              <div className="mt-2 text-xs text-red-600">
                {messages.notifications.browserDenied}
              </div>
            ) : null}
            {browserStatus === "not_configured" ? (
              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {messages.notifications.browserNotConfigured}
              </div>
            ) : null}
            {browserStatus === "save_failed" ? (
              <div className="mt-2 text-xs text-red-600">
                {messages.notifications.browserSaveFailed}
              </div>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`block w-full border-b border-[var(--color-bg-secondary)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-primary-50)] ${
                    notification.readAt
                      ? "bg-white"
                      : "bg-[var(--color-primary-50)]"
                  }`}
                >
                  <div className="text-sm font-bold text-[var(--color-text-main)]">
                    {notificationTitle(notification, locale)}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {notificationBody(notification, locale)}
                  </div>
                  <div className="mt-2 text-[0.68rem] font-medium text-[var(--color-text-light)]">
                    {formatNotificationDate(locale, notification.createdAt)}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                {messages.notifications.empty}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function notificationTitle(
  notification: NotificationItem,
  locale: "en" | "zh",
) {
  return locale === "zh" ? notification.titleZh : notification.titleEn;
}

function notificationBody(notification: NotificationItem, locale: "en" | "zh") {
  return locale === "zh" ? notification.bodyZh : notification.bodyEn;
}

function formatNotificationDate(locale: "en" | "zh", value: Date | string) {
  return formatAppDateTime(locale, new Date(value));
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
