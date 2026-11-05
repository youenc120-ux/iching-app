// 設定頁：顯示設定、備份與還原、用 QR code 把家人的出生資料傳到另一支手機。
// 需要 prefs.js、birth.js（loadPeople、el）。備份只處理本站自己的資料（以下列字首開頭的 localStorage 項目）。

const APP_PREFIXES = ["iching-", "qian-", "tarot-", "palm-", "taisui-", "ui-"];
const SITE_BASE = "https://youenc120-ux.github.io/iching-app/";
const QR_LIB = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

const appKeys = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (APP_PREFIXES.some((p) => key.startsWith(p))) keys.push(key);
  }
  return keys.sort();
};

// 中文也能放進網址：UTF-8 → base64url
const toBase64Url = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

// 出生資料壓成陣列，QR code 才放得下
const PERSON_FIELDS = ["name", "year", "month", "day", "hour", "minute", "gender", "place", "latitude", "longitude", "zone", "tz"];
const packPeople = (people) => people.map((p) => PERSON_FIELDS.map((f) => (f === "gender" ? (p.gender === "female" ? 1 : 0) : p[f] ?? "")));
const unpackPeople = (rows) => rows.map((row) => {
  const p = Object.fromEntries(PERSON_FIELDS.map((f, i) => [f, row[i]]));
  p.gender = row[6] === 1 ? "female" : "male";
  return p;
});
const samePerson = (a, b) => a.name === b.name && a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;

// 把一批人併進已儲存的人：同名同生日的略過，其餘給新編號
function mergePeople(incoming) {
  const people = loadPeople();
  let added = 0;
  for (const person of incoming) {
    if (!person || !person.year || people.some((p) => samePerson(p, person))) continue;
    people.push({ ...person, id: `p${Date.now()}${added}` });
    added++;
  }
  writeJson(PEOPLE_KEY, people);
  return added;
}

let qrLoading = null;
const loadQrLib = () => qrLoading || (qrLoading = new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = QR_LIB;
  script.onload = () => resolve(window.qrcode);
  script.onerror = () => { qrLoading = null; reject(new Error("QR 產生器載入失敗")); };
  document.head.append(script);
}));

(() => {
  const $ = (sel) => document.querySelector(sel);

  // ── 顯示設定 ──
  const prefs = readUiPrefs();
  const save = () => { try { localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs)); } catch { /* 存不了就只用這次 */ } applyUiPrefs(prefs); };
  const segment = (box, key, options) => {
    for (const [value, label] of options) {
      const b = el("button", "tab", label);
      b.type = "button";
      const sync = () => b.classList.toggle("active", (prefs[key] || options[0][0]) === value);
      b.addEventListener("click", () => { prefs[key] = value; save(); box.querySelectorAll("button").forEach((x) => x.sync()); });
      b.sync = sync;
      sync();
      box.append(b);
    }
  };
  segment($("#pref-font"), "font", [["m", "標準"], ["l", "大"], ["xl", "特大"]]);
  segment($("#pref-mode"), "mode", [["night", "夜空（深色）"], ["light", "淺色"]]);
  const elder = $("#pref-elder");
  elder.checked = !!prefs.elder;
  elder.addEventListener("change", () => { prefs.elder = elder.checked; save(); });

  // ── 備份檔 ──
  const status = $("#backup-status");
  const say = (text) => { status.textContent = text; status.hidden = !text; };
  $("#backup-download").addEventListener("click", () => {
    const data = Object.fromEntries(appKeys().map((k) => [k, localStorage.getItem(k)]));
    const blob = new Blob([JSON.stringify({ app: "觀象", version: 1, exported: new Date().toISOString(), data }, null, 1)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `觀象備份-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`已下載備份檔，包含 ${loadPeople().length} 個人和 ${Object.keys(data).length} 項資料。換手機後在這頁按「從備份檔還原」。`);
  });

  const fileInput = $("#backup-file");
  $("#backup-restore").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.app !== "觀象" || !backup.data) throw new Error();
      const entries = Object.entries(backup.data).filter(([k, v]) => APP_PREFIXES.some((p) => k.startsWith(p)) && typeof v === "string");
      let added = 0;
      for (const [key, value] of entries) {
        if (key === PEOPLE_KEY) { added = mergePeople(JSON.parse(value)); continue; }
        localStorage.setItem(key, value);
      }
      say(`還原完成：新增 ${added} 個人，其他 ${entries.length - (backup.data[PEOPLE_KEY] ? 1 : 0)} 項紀錄與設定也已還原（同一個人不會重複加入）。`);
      renderPeople();
      applyUiPrefs();
    } catch {
      say("這個檔案不是觀象的備份檔，或檔案已經損壞。");
    }
  });

  // ── 用 QR code 傳家人資料 ──
  const peopleBox = $("#share-people");
  const qrBox = $("#share-qr");
  const chosen = new Set();
  function renderPeople() {
    const people = loadPeople();
    chosen.clear();
    people.forEach((p) => chosen.add(p.id));
    peopleBox.replaceChildren(...(people.length ? people.map((p) => {
      const box = Object.assign(el("input"), { type: "checkbox", checked: true });
      box.addEventListener("change", () => { box.checked ? chosen.add(p.id) : chosen.delete(p.id); qrBox.replaceChildren(); });
      return el("label", "check", [box, el("span", null, `${p.name}（${p.year}/${p.month}/${p.day}）`)]);
    }) : [el("p", "hint", "還沒有儲存任何人。先到八字、紫微或星盤頁填出生資料。")]));
    $("#share-make").hidden = !people.length;
  }
  renderPeople();

  $("#share-make").addEventListener("click", async () => {
    const people = loadPeople().filter((p) => chosen.has(p.id));
    if (!people.length) { qrBox.replaceChildren(el("p", "hint", "請至少勾一個人。")); return; }
    const link = `${SITE_BASE}settings.html#p=${toBase64Url(JSON.stringify(packPeople(people)))}`;
    qrBox.replaceChildren(el("p", "hint", "產生中…"));
    const copy = el("button", null, "複製匯入連結");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); copy.textContent = "已複製"; } catch { copy.textContent = "複製失敗，請長按下面的連結"; }
    });
    const tail = [
      el("p", "hint", "用另一支手機的相機掃描，會打開觀象並問要不要匯入這些人。資料放在連結的 # 後面，不會傳到任何伺服器；但拿到這個連結或 QR code 的人都看得到這些出生資料，只傳給家人。"),
      el("div", "actions", [copy]),
    ];
    try {
      const qrcode = await loadQrLib();
      const qr = qrcode(0, "M");
      qr.addData(link);
      qr.make();
      const holder = el("div", "backup-qr");
      holder.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
      qrBox.replaceChildren(holder, ...tail);
    } catch {
      qrBox.replaceChildren(el("p", "hint", "QR code 產生器載入失敗（可能沒有網路），可以改用下面的連結。"), ...tail);
    }
  });

  // ── 打開匯入連結時 ──
  const match = location.hash.match(/^#p=([\w-]+)$/);
  if (match) {
    const box = $("#import-card");
    try {
      const incoming = unpackPeople(JSON.parse(fromBase64Url(match[1])));
      const names = incoming.map((p) => `${p.name}（${p.year}/${p.month}/${p.day}）`).join("、");
      const ok = el("button", "primary", `匯入這 ${incoming.length} 個人`);
      ok.type = "button";
      const no = el("button", null, "不要匯入");
      no.type = "button";
      const done = (text) => { history.replaceState(null, "", location.pathname); box.replaceChildren(el("h2", null, "匯入家人資料"), el("p", null, text)); };
      ok.addEventListener("click", () => { const added = mergePeople(incoming); renderPeople(); done(added ? `已加入 ${added} 個人，到八字、紫微、犯太歲等頁就能直接選他們。` : "這些人已經在這支手機上了，沒有重複加入。"); });
      no.addEventListener("click", () => done("沒有匯入任何資料。"));
      box.replaceChildren(el("h2", null, "匯入家人資料"), el("p", null, `這個連結帶了 ${incoming.length} 個人的出生資料：${names}。要加到這支手機嗎？`), el("div", "actions", [ok, no]));
    } catch {
      box.replaceChildren(el("h2", null, "匯入家人資料"), el("p", null, "這個匯入連結不完整或已經損壞，請對方重新產生一次。"));
    }
    box.hidden = false;
    box.scrollIntoView({ block: "start" });
  }
})();
