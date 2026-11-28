const CACHE_NAME = "shoe-store-v2";

// Ресурсы для обязательной предзагрузки при установке PWA
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js",
];

// 1. Установка: сразу сохраняем каркас приложения и библиотеки
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()),
  );
});

// 2. Активация: удаляем старые версии кэша, если версия обновилась
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// 3. Перехват запросов (Stale-While-Revalidate + Cache First для картинок)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Для внешних изображений (например, фото товаров из Unsplash или Firebase Storage)
  if (
    event.request.destination === "image" ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp)$/i)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Если фото есть в кэше — отдаём мгновенно
            return cachedResponse;
          }
          // Если фото нет — загружаем и сохраняем в кэш
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Если сети нет и картинки в кэше нет — игнорируем
            });
        });
      }),
    );
    return;
  }

  // Для остального (HTML, Tailwind, JS библиотеки): отдаём из кэша и обновляем в фоне
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ошибка сети — ничего страшного, отдадим кэш
        });

      return cachedResponse || fetchPromise;
    }),
  );
});
