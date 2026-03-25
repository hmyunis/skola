self.addEventListener("push", (event) => {
  let payload = {
    title: "SKOLA",
    body: "You have a new notification.",
    url: "/",
    tag: "skola-notification",
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: parsed?.data || {},
      };
    } catch {
      const text = event.data.text();
      payload = { ...payload, body: text || payload.body };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.tag || "skola-notification",
      data: {
        url: payload.url || "/",
        ...(payload.data || {}),
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          client.postMessage({ type: "SKOLA_PUSH_CLICK", url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
