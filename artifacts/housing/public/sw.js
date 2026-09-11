// Sunrise Housing - Service Worker Cache Purge & Migration
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .then(() => {
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          for (const client of clients) {
            client.navigate(client.url);
          }
        });
      })
  );
});

self.addEventListener("fetch", (event) => {
  // Always bypass cache and fetch directly from network
  event.respondWith(fetch(event.request));
});

