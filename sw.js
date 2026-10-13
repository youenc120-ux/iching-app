// Service worker：有網路時永遠拿最新的檔案並更新快取，沒網路時才用快取。
// 這樣開發時改了檔案重新整理就看得到，不會被舊快取卡住。
const CACHE = "iching-v1";
const FILES = [
  "./", "index.html", "catalog.html", "style.css", "manifest.webmanifest",
  "js/hexagrams-1.js", "js/hexagrams-2.js", "js/divination.js", "js/reading.js",
  "js/app.js", "js/catalog.js", "js/pwa.js",
  "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
