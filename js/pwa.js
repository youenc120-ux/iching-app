// 註冊 service worker，讓 app 可以「加入主畫面」並離線使用。
// 只有透過 http(s) 開啟時才有效；直接雙擊 index.html（file://）時會略過。
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* 註冊失敗不影響使用 */ });
  });
}

// 手機上選單比螢幕寬，要左右滑。載入時把目前這一頁捲到中間，才看得出自己在哪一頁。
(() => {
  const nav = document.querySelector(".nav");
  const current = nav && nav.querySelector(".current");
  if (current) nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
})();
