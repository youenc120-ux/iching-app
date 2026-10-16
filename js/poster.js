// 把結果存成圖片：共用的畫布、主題配色、文字換行與分享／下載。各頁只負責畫自己的內容。

const SITE_NAME = "觀象";
const POSTER_THEMES = {
  iching: { top: "#fbf6ec", bottom: "#f0e4d0", ink: "#1f1b16", muted: "#7b7265", accent: "#b8322a", line: "#e2d6c0", panel: "rgba(255,255,255,0.55)" },
  bazi: { top: "#f4f8f1", bottom: "#dfecd9", ink: "#18211c", muted: "#68756c", accent: "#2c7f5b", line: "#cfdcc8", panel: "rgba(255,255,255,0.6)" },
  ziwei: { top: "#201744", bottom: "#0e0a20", ink: "#f1ecff", muted: "#aaa1d2", accent: "#e6ba5f", line: "rgba(160,140,255,0.3)", panel: "rgba(60,48,112,0.55)" },
  astro: { top: "#101a40", bottom: "#060a1b", ink: "#e9efff", muted: "#95a2cb", accent: "#7cc4ff", line: "rgba(124,160,255,0.3)", panel: "rgba(30,42,90,0.6)" },
  qian: { top: "#3a120c", bottom: "#160604", ink: "#f8ebd6", muted: "#c9a98d", accent: "#e8b84a", line: "rgba(232,184,74,0.3)", panel: "rgba(80,24,14,0.55)" },
  almanac: { top: "#fbf4e4", bottom: "#efe1c2", ink: "#2a1d14", muted: "#7f6f5c", accent: "#b3261e", line: "#e2cfa8", panel: "rgba(255,255,255,0.6)" },
  numero: { top: "#123136", bottom: "#081719", ink: "#e8f5f2", muted: "#9ab8b3", accent: "#5fd3bc", line: "rgba(95,211,188,0.3)", panel: "rgba(28,62,68,0.6)" },
  tarot: { top: "#2c1220", bottom: "#12070d", ink: "#f6ebe4", muted: "#bfa3a8", accent: "#d8a657", line: "rgba(216,166,87,0.3)", panel: "rgba(70,30,50,0.55)" },
  compat: { top: "#fdf1f2", bottom: "#f6dfe6", ink: "#2a1a22", muted: "#8a6c78", accent: "#c8456f", line: "#ecd0da", panel: "rgba(255,255,255,0.6)" },
};
const POSTER_ELEMENT_COLORS = { 木: "#3f9d6b", 火: "#e0563f", 土: "#c9973a", 金: "#8e98a8", 水: "#3d82d9" };
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
