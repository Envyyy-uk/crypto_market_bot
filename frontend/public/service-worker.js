/*
 * Service Worker. Завдання 15-16.
 *
 * Стратегії:
 *  - Статика (JS/CSS/шрифти/іконки): cache-first — інтерфейс відкривається офлайн.
 *  - Навігація: network-first із фолбеком на кешовану оболонку.
 *  - API (/api/, /ws/): не кешуємо — ринкові дані застарівають миттєво.
 *  - push / notificationclick: доставка сповіщень (Завдання 15).
 */

const CACHE_NAME = "cryptobot-shell-v1";
const APP_SHELL = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ринкові дані ніколи не кешуємо
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) return;
  if (event.request.method !== "GET") return;

  // Навігація: мережа -> кеш оболонки (офлайн-режим)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/").then((r) => r ?? Response.error()))
    );
    return;
  }

  // Статика: кеш -> мережа (з дозаписом у кеш)
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});

/* ---------- Web Push (Завдання 15) ---------- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Crypto Market Bot", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Crypto Market Bot";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  // Відкриваємо потрібну сторінку або фокусуємо вже відкриту вкладку
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
