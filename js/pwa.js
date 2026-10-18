// 註冊 service worker，讓 app 可以「加入主畫面」並離線使用。
// 只有透過 http(s) 開啟時才有效；直接雙擊 index.html（file://）時會略過。
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* 註冊失敗不影響使用 */ });
  });
}

// 「全部」面板用瀏覽器內建的 popover；舊瀏覽器不支援時，改用加上 .open 的方式開關。
(() => {
  const menu = document.querySelector("#menu");
  if (!menu || "popover" in HTMLElement.prototype) return;
  for (const button of document.querySelectorAll("[popovertarget=menu]")) {
    button.addEventListener("click", () => menu.classList.toggle("open", button.getAttribute("popovertargetaction") !== "hide" && !menu.classList.contains("open")));
  }
})();
