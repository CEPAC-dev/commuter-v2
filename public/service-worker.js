self.addEventListener("push", (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: "Commuter", body: event.data.text() };
    }

    const isArabic = (self.navigator.language || "").toLowerCase().startsWith("ar");
    const title = isArabic && payload.titleAr ? payload.titleAr : payload.title;
    const body = isArabic && payload.bodyAr ? payload.bodyAr : payload.body;

    event.waitUntil(
        self.registration.showNotification(title || "Commuter", {
            body: body || "You have a new notification.",
            icon: "/assets/images/commuterLogo.png",
            badge: "/assets/images/commuterLogo.png",
            tag: payload.id || undefined,
            data: { url: payload.url || "/user/notifications" },
            renotify: true,
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const requestedUrl = event.notification.data?.url || "/user/notifications";
    let targetUrl = "/user/notifications";
    try {
        const parsed = new URL(requestedUrl, self.location.origin);
        if (parsed.origin === self.location.origin) targetUrl = parsed.href;
    } catch {
        targetUrl = "/user/notifications";
    }

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.startsWith(self.location.origin) && "focus" in client) {
                    return client.navigate(targetUrl).then((navigatedClient) =>
                        (navigatedClient || client).focus(),
                    );
                }
            }
            return self.clients.openWindow(targetUrl);
        }),
    );
});
