/**
 * The DevPuls service worker.
 *
 * Two responsibilities:
 *  1. receiving the Web Push notifications sent by `packages/agent`,
 *  2. a minimal offline cache for the application shell.
 *
 * The file is served from `/sw.js`, so its scope is the whole origin.
 */

const CACHE = "devpuls-v1";

/** Assets without which the app shows nothing useful offline. */
const SHELL = ["/", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  // The new worker takes over without waiting for old tabs to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Network-first: the news has to be fresh, the cache is only a fallback.
 * Everything but GET is skipped — POSTs to /api/push/* have nothing to cache.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
  );
});

/**
 * The payload sent by `packages/agent/src/push.ts`:
 * { title, body, url }
 */
self.addEventListener("push", (event) => {
  let payload = { title: "DevPuls", body: "Nowy wpis", url: "/" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // Should plain text ever arrive instead of JSON — we do not lose the notification.
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "pl",
      // Tagged by URL: a repeated push about the same item replaces the
      // notification instead of stacking another one.
      tag: payload.url,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, we do not multiply windows.
        for (const client of clientList) {
          if (client.url === target && "focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
