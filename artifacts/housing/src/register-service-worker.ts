export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Always unregister active service workers and clear caches in development / local testing
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().catch(() => {});
    }
  });

  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name).catch(() => {});
      }
    });
  }
}

