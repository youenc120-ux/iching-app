// Service worker：有網路時永遠拿最新的檔案並更新快取，沒網路時才用快取。
// 這樣開發時改了檔案重新整理就看得到，不會被舊快取卡住。
const CACHE = "iching-v15";
const FILES = [
  "./", "index.html", "iching.html", "catalog.html", "bazi.html", "ziwei.html", "astro.html", "compat.html", "about.html",
  "style.css", "manifest.webmanifest",
  "js/hexagrams-1.js", "js/hexagrams-2.js", "js/lunar-data.js", "js/divination.js", "js/texts.js", "js/reading.js",
  "js/scenes-1.js", "js/scenes-2.js", "js/advice.js", "js/scene.js",
  "js/najia.js", "js/app.js", "js/catalog.js", "js/birth.js", "js/poster.js", "js/bazi.js", "js/ziwei.js", "js/astro.js",
  "js/compat.js", "js/home.js", "js/share.js", "js/pwa.js",
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
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  // no-cache：每次都向伺服器確認檔案有沒有更新，避免網站更新後還拿到瀏覽器暫存的舊檔
  event.respondWith(
    fetch(event.request.url, { cache: "no-cache" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
