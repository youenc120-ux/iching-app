// 顯示設定（字體大小、淺色主題、長輩模式）：放在 <head>，畫面出現前就套用，避免閃一下。
// 設定存在這台裝置的 localStorage「ui-prefs」，在「設定」頁修改。
const UI_PREFS_KEY = "ui-prefs";
function readUiPrefs() {
  try { return JSON.parse(localStorage.getItem(UI_PREFS_KEY)) || {}; } catch { return {}; }
}
function applyUiPrefs(prefs = readUiPrefs()) {
  const root = document.documentElement;
  root.dataset.font = prefs.font || "m";
  root.dataset.mode = prefs.mode || "night";
  if (prefs.elder) root.dataset.elder = "1";
  else delete root.dataset.elder;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = root.dataset.mode === "light" ? "#f4f1fa" : "#0d0b1e";
}
applyUiPrefs();
