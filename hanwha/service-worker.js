const CACHE_NAME = "eagles-lounge-v23";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css?v=21",
  "./script.js?v=21",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/hero-stadium.png",
  "./data/meta.json?v=19",
  "./data/summary.json?v=19",
  "./data/team-standings.json?v=19",
  "./data/live-game.json?v=19",
  "./data/player-rankings.json?v=19",
  "./data/games.json?v=19",
  "./data/ticketing-calendar.json?v=19",
  "./data/players.json?v=19",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (url.pathname.includes("/data/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request, fallback = null) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    // 200 류 정상 응답만 캐시한다. 404/500/리다이렉트(점검 페이지 등)가
    // 영구히 캐시에 박혀 잘못된 콘텐츠를 서빙하는 것을 막는다.
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return cache.match(fallback ?? "./offline.html");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("notificationclick", (event) => {
  const targetUrl = new URL(event.notification.data?.url ?? "./index.html#live", self.registration.scope).href;
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 하위경로(/minsubsong/) 배포에서는 진입 URL에 index.html 이 없을 수 있으므로
        // 등록 scope 기준으로 기존 창을 찾는다.
        const scope = self.registration.scope;
        const existingClient =
          clientList.find((client) => client.url.startsWith(scope)) ?? clientList[0];

        if (existingClient) {
          existingClient.focus();
          return existingClient.navigate(targetUrl);
        }

        return clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-data") {
    event.waitUntil(refreshDataCache());
  }
});

async function refreshDataCache() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL.filter((url) => url.includes("/data/")).map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });

        if (response.ok) {
          await cache.put(url, response.clone());
        }
      } catch {
        // 네트워크 실패 시 기존 캐시를 유지한다.
      }
    }),
  );
}
