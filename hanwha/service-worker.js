const CACHE_NAME = "eagles-lounge-v33";
// Pretendard(CDN) 런타임 캐시 — 앱 셸 버전과 독립. stale-while-revalidate 로
// 오프라인 재방문 시 폰트 유지. activate 정리에서 보존한다.
const FONT_CACHE = "fonts-v1";
// script.js 게이트 상수 미러(배포 시 동일 값으로 교체; 빈 값이면 inert).
const PUSH_API_BASE = "";
const PUSH_VAPID_PUBLIC_KEY = "";
function urlB64ToUint8Array(b) {
  const pad = "=".repeat((4 - (b.length % 4)) % 4);
  const s = (b + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(s)].map((c) => c.charCodeAt(0)));
}
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css?v=33",
  "./script.js?v=33",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./assets/hero-stadium.png",
  "./data/meta.json?v=19",
  "./data/summary.json?v=19",
  "./data/team-standings.json?v=19",
  "./data/live-game.json?v=19",
  "./data/games.json?v=19",
  "./data/ticketing-calendar.json?v=19",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME && key !== FONT_CACHE).map((key) => caches.delete(key)),
        ),
      ),
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

  // Pretendard CDN(CSS + woff2 서브셋) → 별도 폰트 캐시 stale-while-revalidate.
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      // CORS 정상 응답(.ok) 또는 opaque 응답만 캐시.
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

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

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "KBO TIDO";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "./assets/app-icon.svg",
      badge: "./assets/app-icon.svg",
      tag: payload.tag || "kbo-tido-push",
      data: { url: payload.url || "./index.html#live" },
    }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // endpoint 회전 시 재구독(이전 옵션 재사용, 없으면 VAPID 키로 재구성) + 백엔드 재등록.
  event.waitUntil(
    (async () => {
      try {
        const options = event.oldSubscription?.options ?? {
          userVisibleOnly: true,
          ...(PUSH_VAPID_PUBLIC_KEY
            ? { applicationServerKey: urlB64ToUint8Array(PUSH_VAPID_PUBLIC_KEY) }
            : {}),
        };
        const sub = await self.registration.pushManager.subscribe(options);
        if (PUSH_API_BASE) {
          const json = sub.toJSON();
          await fetch(`${PUSH_API_BASE}/api/subscriptions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
            }),
          });
        }
      } catch {
        // 무시 — 클라 재방문 시 재등록.
      }
    })(),
  );
});

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
