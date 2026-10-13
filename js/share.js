// 每一頁頁尾的「分享這個網站」區塊：QR code、分享與複製網址按鈕、加到主畫面的說明。
// 自成一個檔案，不依賴其他程式，所有頁面都載入。
(() => {
  const SITE_URL = "https://youenc120-ux.github.io/iching-app/";
  const SITE_NAME = "易經卜卦";
  // SITE_URL 的 QR code（29×29，容錯等級 M），每一列的黑白格轉成 36 進位。
  // 網址如果改了，這張圖要重新產生，否則掃出來還是舊網址。
  const QR_SIZE = 29;
  const QR_ROWS = ("8ubf5r,4j2u69,6ge15p,6h5m59,6gmli5,4ikx1d,8tz2pr,xrls,6cjsqz,346ktt,6qwfra,54xush,43prm4,69ox1j,11r1wn,"
    + "4i4dwy,3jj5zu,460rla,66yl5w,1kwec4,2hczy4,nc4f,8u51zu,4jk6xk,6gjunr,6h4p4p,6h58dh,4iviyi,8tx20q").split(",");

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // 把 QR 資料畫成 SVG：四周留四格白邊，掃描器才認得出來
  function qrSvg() {
    const NS = "http://www.w3.org/2000/svg";
    const quiet = 4;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${QR_SIZE + quiet * 2} ${QR_SIZE + quiet * 2}`);
    svg.setAttribute("class", "share-qr");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "網站網址的 QR code");
    const background = document.createElementNS(NS, "rect");
    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", "#fff");
    let path = "";
    QR_ROWS.forEach((packed, row) => {
      const bits = parseInt(packed, 36).toString(2).padStart(QR_SIZE, "0");
      [...bits].forEach((bit, column) => {
        if (bit === "1") path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
      });
    });
    const modules = document.createElementNS(NS, "path");
    modules.setAttribute("d", path);
    modules.setAttribute("fill", "#000");
    svg.append(background, modules);
    return svg;
  }

  // 依裝置給「加到主畫面」的做法；已經是從主畫面開啟的就不用再提示
  function installTip() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) return "";
    const agent = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(agent)) return "加到主畫面：用 Safari 開啟，按下方的分享鈕，選「加入主畫面」。之後點圖示就能開，不用記網址。";
    if (/Android/.test(agent)) return "加到主畫面：按瀏覽器右上角的選單，選「加到主畫面」或「安裝應用程式」。之後點圖示就能開，不用記網址。";
    return "在手機上可以把這個網站加到主畫面，之後點圖示就能開，不用記網址。用手機相機掃左邊的 QR code 就能打開。";
  }

  function build() {
    const main = document.querySelector("main");
    if (!main) return;
    const status = make("span", "share-status");
    const say = (text) => {
      status.textContent = text;
      setTimeout(() => { status.textContent = ""; }, 2500);
    };

    const shareButton = make("button", "primary", "分享");
    shareButton.type = "button";
    shareButton.hidden = !navigator.share;
    shareButton.addEventListener("click", async () => {
      try {
        await navigator.share({ title: SITE_NAME, text: "易經卜卦、八字、紫微斗數、星盤", url: SITE_URL });
      } catch {
        // 使用者自己取消分享，不用處理
      }
    });

    const copyButton = make("button", null, "複製網址");
    copyButton.type = "button";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(SITE_URL);
        say("已複製");
      } catch {
        say("複製失敗，請長按下方網址手動複製");
      }
    });

    const actions = make("div", "actions");
    actions.append(shareButton, copyButton, status);
    const text = make("div", "share-text");
    text.append(make("h4", null, "分享這個網站"), make("p", "share-url", SITE_URL), actions);
    const tip = installTip();
    if (tip) text.append(make("p", "hint", tip));

    const block = make("section", "card share");
    block.append(qrSvg(), text);
    main.append(block);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
