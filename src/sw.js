// Service worker: offline shell cache plus web-push handlers (used in a later phase).

const CACHE = "kids-reminders-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Network-first so updates are picked up; fall back to cache when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((r) => r || caches.match("./index.html"))),
  );
});

// Web Push (wired up in a later phase).
self.addEventListener("push", (event) => {
  let payload = { title: "תזכורות לילדים", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "תזכורות לילדים", {
      body: payload.body || "",
      dir: "rtl",
      lang: "he",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsList) => {
      if (clientsList.length) return clientsList[0].focus();
      return self.clients.openWindow("./");
    }),
  );
});
