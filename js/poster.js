// 把結果存成圖片：共用的畫布、主題配色、文字換行與分享／下載。各頁只負責畫自己的內容。

const SITE_NAME = "觀象";
// 圖片和網站同一套：石色宣紙、墨字、朱印
const POSTER_PAPER = { top: "#f3f5f3", bottom: "#e6e9e6", ink: "#1b1a18", muted: "#5f6462", accent: "#b02a1d", line: "#d3d8d4", panel: "rgba(255,255,255,0.7)" };
const POSTER_THEMES = Object.fromEntries(["iching","bazi","ziwei","astro","qian","almanac","numero","name","tarot","compat"].map((key) => [key, POSTER_PAPER]));
const POSTER_ELEMENT_COLORS = { 木: "#2f7d52", 火: "#c4452c", 土: "#a0701f", 金: "#6f7887", 水: "#2c6cb8" };
const POSTER_SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const POSTER_SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

// 建立 1080×1350 的畫布，畫好背景、外框、頁首與頁尾。回傳 { canvas, ctx, colors }
function createPoster(themeName, heading) {
  const colors = POSTER_THEMES[themeName];
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 1350);
  gradient.addColorStop(0, colors.top);
  gradient.addColorStop(1, colors.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  posterRoundRect(ctx, 40, 40, 1000, 1270, 36);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = colors.accent;
  ctx.font = `700 34px ${POSTER_SERIF}`;
  ctx.fillText(`${SITE_NAME}　${heading}`, 540, 118);
  ctx.fillStyle = colors.muted;
  ctx.font = `24px ${POSTER_SANS}`;
  ctx.fillText("僅供參考，重要決定請自己判斷", 540, 1272);
  return { canvas, ctx, colors };
}

function posterRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// 半透明底板，用來襯住一塊內容
function posterPanel(ctx, colors, x, y, width, height) {
  ctx.fillStyle = colors.panel;
  posterRoundRect(ctx, x, y, width, height, 28);
  ctx.fill();
}

// 中文逐字換行，回傳畫完後的 y 座標
function posterWrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = "";
  let lines = 0;
  for (const char of text) {
    if (char === "\n" || ctx.measureText(line + char).width > maxWidth) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char === "\n" ? "" : char;
      if (++lines >= maxLines) return y;
    } else {
      line += char;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function downloadBlob(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// 手機上直接叫出分享選單；不支援就下載檔案
async function savePoster(canvas, name) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: SITE_NAME });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // 使用者自己取消
    }
  }
  downloadBlob(blob, name);
}

// 產生一顆「存成圖片」按鈕；draw 回傳畫好的 canvas
function posterButton(draw, name) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "存成圖片";
  button.addEventListener("click", async () => {
    // 先等網頁字體載完，圖上的字才不會退回系統字體
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    savePoster(draw(), name);
  });
  return button;
}
