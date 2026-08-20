/**
 * Service worker DevPulsa.
 *
 * Dwie odpowiedzialności:
 *  1. odbiór powiadomień Web Push wysyłanych przez `packages/agent`,
 *  2. minimalny cache offline dla powłoki aplikacji.
 *
 * Plik jest serwowany z `/sw.js`, więc jego zakres to całe origin.
 */

const CACHE = "devpuls-v1";

/** Zasoby, bez których appka nie pokaże nic sensownego offline. */
const SHELL = ["/", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  // Nowy worker przejmuje kontrolę bez czekania na zamknięcie starych kart.
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
 * Network-first: newsy mają być świeże, cache jest tylko awaryjny.
 * Pomijamy wszystko poza GET — POST-y do /api/push/* nie mają czego cache'ować.
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
 * Payload wysyłany przez `packages/agent/src/push.ts`:
 * { title, body, url }
 */
self.addEventListener("push", (event) => {
  let payload = { title: "DevPuls", body: "Nowy wpis", url: "/" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      // Gdyby kiedyś przyszedł zwykły tekst zamiast JSON-a — nie gubimy powiadomienia.
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "pl",
      // Tag po URL-u: ponowny push o tym samym wpisie podmienia powiadomienie,
      // zamiast dokładać kolejne.
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
        // Jeśli appka jest już otwarta, nie mnożymy okien.
        for (const client of clientList) {
          if (client.url === target && "focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
