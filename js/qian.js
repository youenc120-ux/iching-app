// 求籤頁：擲筊請示 → 搖籤筒抽籤 → 擲筊確認 → 籤詩與解籤。
// 需要 reading.js（問法與類別判斷）、qian-data.js、poster.js。

const QIAN_HISTORY_KEY = "qian-history";
const QIAN_CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, QIAN_CALM ? 0 : ms));
const $ = (selector) => document.querySelector(selector);

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

function randomInt(n) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}

const QIAN_NUMBERS = "一二三四五六七八九十";
function qianNumber(n) {
  if (n <= 10) return QIAN_NUMBERS[n - 1];
  const tens = Math.floor(n / 10), ones = n % 10;
  return `${tens > 1 ? QIAN_NUMBERS[tens - 1] : ""}十${ones ? QIAN_NUMBERS[ones - 1] : ""}`;
}

function qianOf(n) {
  const [num, ganzhi, attr, poem, stories, cats, level, plain, variant] = QIAN[n - 1];
  return { num, ganzhi, attr, poem: poem.match(/[^，。]+[，。]/g), stories, cats, level, plain, variant };
}

// 籤的等第：依吉凶評等
const QIAN_GRADES = { 5: "上上籤", 4: "上籤", 3: "中籤", 2: "下籤", 1: "下下籤" };

// 問的類別對應到籤譜上的哪幾項；問題裡出現特定的字，再加上對應的項目
const TOPIC_CATS = {
  love: ["婚姻"], career: ["作事", "功名"], money: ["求財", "經商"], study: ["功名"],
  health: ["治病"], travel: ["出外", "移居"], general: ["凡事"],
};
const EXTRA_CATS = [
  [/掉了|遺失|弄丟|找不到|不見了/, "失物"], [/官司|訴訟|告|法院|糾紛/, "官事"], [/懷孕|生男|生女|小孩|求子|胎/, "六甲"],
  [/消息|回信|音訊|聯絡/, "遠信"], [/搬家|搬遷|遷居|買房/, "移居"], [/找人|失聯|下落/, "尋人"], [/家裡|家人|家運|家庭/, "家運"],
  [/生意|做生意|開店/, "經商"], [/考試|升學|功名|升遷/, "功名"],
];

// 籤解常見的用語
const QIAN_GLOSSARY = [
  ["月光", "上半月、事情明朗的時候"], ["月暗", "下半月、事情不明的時候"], ["拖尾", "拖延、拖很久才了結"], ["了錢", "破財"],
  ["和者吉", "以和為貴、能和解就好"], ["呆", "不好"], ["不畏", "不要緊"], ["允成", "會成"], ["子媳", "子孫"],
  ["六甲", "懷孕生產"], ["歲君", "流年運勢"], ["討海", "出海捕魚"], ["月半", "月中"],
];

let topic = "auto";
let busy = false;
let state = { step: 1, tries: 0, number: 0, confirms: 0 };

// ── 擲筊 ── 兩片筊各自正反：一平一凸是聖筊（同意），兩平是笑筊（再想想），兩凸是陰筊（不同意）
async function tossJiao() {
  const pair = $("#jiao");
  const faces = [randomInt(2), randomInt(2)]; // 1 = 平面朝上
  pair.classList.remove("landed");
  pair.classList.add("tossing");
  if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
  await wait(900);
  pair.classList.remove("tossing");
  pair.querySelectorAll(".jiao").forEach((j, i) => j.classList.toggle("flat", faces[i] === 1));
  pair.classList.add("landed");
  const flats = faces[0] + faces[1];
  return flats === 1 ? "聖筊" : flats === 2 ? "笑筊" : "陰筊";
}

function logToss(label, result) {
  $("#toss-log").append(el("li", `toss ${result === "聖筊" ? "yes" : "no"}`, `${label}：${result}`));
}

function setStep(step) {
  state.step = step;
  document.querySelectorAll("#steps li").forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle("done", n < step);
    li.classList.toggle("active", n === step);
  });
}

function actions(list) {
  $("#ritual-actions").replaceChildren(...list.map(([label, fn, primary]) => {
    const b = el("button", primary ? "primary" : "", label);
    b.type = "button";
    b.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      await fn();
      busy = false;
    });
    return b;
  }));
}

function say(text) {
  $("#status").textContent = text;
}

function resetRitual() {
  state = { step: 1, tries: 0, number: 0, confirms: 0 };
  setStep(1);
  $("#toss-log").replaceChildren();
  $("#tube").classList.remove("drawn");
  $("#drawn-stick").textContent = "";
  $("#jiao").classList.remove("landed");
  say("準備好之後，按下「擲筊」向媽祖請示能不能求籤。");
  actions([["擲筊", askPermission, true]]);
}

// 第一步：請示能不能求籤
async function askPermission() {
  if (!$("#question").value.trim()) {
    say("先在上面寫下要請示的事，再擲筊。");
    $("#question").focus();
    return;
  }
  say("擲筊中……");
  const result = await tossJiao();
  state.tries++;
  logToss(`請示第 ${state.tries} 次`, result);
  if (result === "聖筊") {
    setStep(2);
    say("聖筊，媽祖允許你求籤。心裡想著問題，搖動籤筒。");
    actions([["搖籤筒", drawStick, true]]);
  } else if (state.tries >= 3) {
    say(`三次都沒有聖筊。民間的說法是：今天先不要問這件事，或是問題還不夠清楚。把問題想清楚、說具體一點再來。`);
    actions([["重新開始", async () => resetRitual(), true]]);
  } else {
    say(result === "笑筊"
      ? "笑筊：神明在笑，表示問題沒說清楚，或答案你心裡其實已經知道。把問題再說清楚一點，再擲一次。"
      : "陰筊：神明不同意，或時機不對。靜下心來，再擲一次。");
    actions([["再擲一次", askPermission, true]]);
  }
}

// 第二步：搖籤筒，跳出一支籤
async function drawStick() {
  const tube = $("#tube");
  tube.classList.remove("drawn");
  tube.classList.add("shaking");
  say("搖籤中……");
  if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 30]);
  await wait(1500);
  tube.classList.remove("shaking");
  state.number = randomInt(60) + 1;
  state.confirms = 0;
  $("#drawn-stick").textContent = `第${qianNumber(state.number)}籤`;
  tube.classList.add("drawn");
  setStep(3);
  const need = $("#strict").checked ? "連續三個聖筊" : "一個聖筊";
  say(`抽到第${qianNumber(state.number)}籤。擲筊請示是不是這一支，要${need}才算數。`);
  actions([["擲筊確認", confirmStick, true]]);
}

// 第三步：確認這支籤
async function confirmStick() {
  say("擲筊確認中……");
  const result = await tossJiao();
  state.confirms++;
  logToss(`第${qianNumber(state.number)}籤確認`, result);
  const need = $("#strict").checked ? 3 : 1;
  if (result !== "聖筊") {
    say(`${result}：不是這一支。把籤放回籤筒，重新搖一次。`);
    setStep(2);
    actions([["重新搖籤", drawStick, true]]);
    return;
  }
  const holy = [...$("#toss-log").children].slice(-state.confirms).every((li) => li.classList.contains("yes"));
  if (holy && state.confirms >= need) {
    setStep(4);
    say(`聖筊，就是第${qianNumber(state.number)}籤。`);
    actions([["再求一支籤", async () => resetRitual()]]);
    const entry = { question: $("#question").value.trim(), topic, number: state.number, time: Date.now() };
    saveHistory(entry);
    showQian(entry, true);
  } else {
    say(`聖筊（${state.confirms}／${need}），再擲一次確認。`);
    actions([["擲筊確認", confirmStick, true]]);
  }
}

// ── 解籤 ──
function qianReading(entry) {
  const q = qianOf(entry.number);
  const topicInfo = detectTopic(entry.question, entry.topic);
  const form = detectForm(entry.question);
  const keys = [...TOPIC_CATS[topicInfo.key]];
  for (const [pattern, key] of EXTRA_CATS) if (pattern.test(entry.question || "") && !keys.includes(key)) keys.push(key);
  if (!keys.includes("凡事")) keys.push("凡事");
  const words = (text) => (text || "").replace(/卦象/g, "籤意").replace(/辭裡/g, "籤裡").replace(/辭意/g, "籤意").replace(/這一卦/g, "這支籤").replace(/卦/g, "籤");
  let answer;
  if (form.type === "timing") answer = `籤詩不會給確切的日期。${q.level >= 4 ? "這是好籤，事情的走向是順的，不用等太久。" : q.level === 3 ? "這是中籤，事情會動，但需要時間，中間可能反覆。" : "這支籤不順，會比你預期的晚，也可能不成。"}`;
  else if (form.type === "choice") answer = `一支籤只能回答一件事，沒辦法比較兩個選項。可以分開各求一次「選這個好不好」。先說整體：${words(LEVELS[q.level].verdict)}`;
  else answer = words(directAnswer(form, q.level, 0));
  const lines = [answer, `【籤詩的意思】${q.plain}`];
  const asked = keys.filter((k) => q.cats[k]).map((k) => `${k}：${q.cats[k]}`);
  if (asked.length) lines.push(`【你問的事，籤譜上寫】${asked.join("　")}`);
  const followTable = FORM_FOLLOWUPS[form.bad ? "outcomeBad" : form.type];
  const follow = followTable ? followTable[q.level] : TOPIC_ADVICE[topicInfo.key][q.level];
  if (follow) lines.push(`【建議】${words(follow)}`);
  if (topicInfo.key === "health") lines.push("身體的事以醫師的診斷為準，籤只能參考。");
  return { q, lines, keys, topicInfo };
}

function slip(q) {
  return el("div", "qian-slip", [
    el("div", "slip-head", [el("span", "slip-no", `第${qianNumber(q.num)}籤`), el("span", "slip-gz", q.ganzhi)]),
    el("div", "slip-poem", q.poem.map((line) => el("p", null, line.replace(/[，。]/, "")))),
    el("div", "slip-foot", [q.attr ? el("span", null, q.attr.replace("屬", "屬").replace("宜其", "　宜其")) : el("span", null, "屬性各版本說法不一"), el("span", "slip-grade", QIAN_GRADES[q.level])]),
  ]);
}

function showQian(entry, animate) {
  const { q, lines, keys } = qianReading(entry);
  const root = $("#result");
  root.replaceChildren();
  root.hidden = false;
  const card = el("section", `card qian-result${animate ? " reveal" : ""}`);
  card.append(
    el("p", "meta", new Date(entry.time).toLocaleString("zh-TW")),
    el("h2", null, entry.question ? `問：${entry.question}` : "求籤"),
    slip(q),
  );
  const tone = LEVELS[q.level];
  const reading = el("div", "reading", [
    el("div", "reading-head", [el("h4", null, "解籤"), el("span", `tone ${tone.tier}`, QIAN_GRADES[q.level])]),
    el("div", "reading-part", [el("h5", null, "直說"), el("p", null, lines.join("\n"))]),
    el("div", "reading-part", [el("h5", null, "典故"), el("p", null, q.stories.join("、") + (q.variant ? `\n${q.variant}` : ""))]),
  ]);
  // 籤譜上的各項籤解，問到的那幾項標出來
  const table = el("dl", "qian-cats", Object.entries(q.cats).flatMap(([k, v]) => [
    el("dt", keys.includes(k) ? "asked" : "", k), el("dd", keys.includes(k) ? "asked" : "", v),
  ]));
  const glossary = el("details", "qian-glossary", [
    el("summary", null, "籤解用語說明"),
    el("p", null, QIAN_GLOSSARY.map(([w, m]) => `${w}＝${m}`).join("；") + "。"),
  ]);
  reading.append(el("div", "reading-part", [el("h5", null, "傳統籤解"), table, glossary]));
  const poster = posterButton(() => qianPoster(entry, q, lines), `觀象-第${q.num}籤.png`);
  card.append(reading, el("div", "actions summary-actions", [poster]));
  root.append(card);
  root.scrollIntoView({ behavior: QIAN_CALM ? "auto" : "smooth", block: "start" });
}

// ── 存成圖片 ── 籤紙樣式：直書的四句籤詩
function qianPoster(entry, q, lines) {
  const { canvas, ctx, colors } = createPoster("qian", `媽祖靈籤 · ${new Date(entry.time).toLocaleDateString("zh-TW")}`);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 42px ${POSTER_SERIF}`;
  let y = posterWrap(ctx, entry.question ? `問：${entry.question}` : "求籤", 540, 190, 900, 56, 2);
  // 籤紙
  const top = y + 30, h = 560;
  ctx.fillStyle = "#f3e1b8";
  posterRoundRect(ctx, 200, top, 680, h, 18);
  ctx.fill();
  ctx.strokeStyle = "#a8261a";
  ctx.lineWidth = 6;
  posterRoundRect(ctx, 220, top + 20, 640, h - 40, 10);
  ctx.stroke();
  ctx.fillStyle = "#a8261a";
  ctx.textAlign = "center";
  ctx.font = `700 40px ${POSTER_SERIF}`;
  ctx.fillText(`第${qianNumber(q.num)}籤　${q.ganzhi}`, 540, top + 80);
  ctx.font = `700 44px ${POSTER_SERIF}`;
  ctx.fillStyle = "#2a1408";
  q.poem.forEach((line, col) => {
    const x = 540 + (1.5 - col) * 120;
    [...line.replace(/[，。]/, "")].forEach((ch, row) => ctx.fillText(ch, x, top + 150 + row * 52));
  });
  ctx.fillStyle = "#a8261a";
  ctx.font = `700 36px ${POSTER_SERIF}`;
  ctx.fillText(QIAN_GRADES[q.level], 540, top + h - 40);
  ctx.fillStyle = colors.ink;
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.textAlign = "left";
  posterWrap(ctx, `${lines[0]}${q.plain}`, 110, top + h + 70, 860, 46, 6);
  return canvas;
}

// ── 紀錄 ──
function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(QIAN_HISTORY_KEY));
    return Array.isArray(list) ? list.filter((e) => e && e.number >= 1 && e.number <= 60) : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  try { localStorage.setItem(QIAN_HISTORY_KEY, JSON.stringify([entry, ...loadHistory()].slice(0, 60))); } catch { /* 存不了就算了 */ }
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  $("#history-list-wrap").hidden = !list.length;
  $("#history").replaceChildren(...list.map((entry) => {
    const q = qianOf(entry.number);
    const b = el("button", "history-item", [
      el("span", "history-hex", `第${qianNumber(q.num)}籤 ${q.ganzhi} · ${QIAN_GRADES[q.level]}`),
      el("span", "history-q", entry.question || "（沒有寫問題）"),
      el("span", "history-time", new Date(entry.time).toLocaleDateString("zh-TW")),
    ]);
    b.type = "button";
    b.addEventListener("click", () => showQian(entry, false));
    return el("li", null, [b]);
  }));
}

// ── 六十首總覽 ──
function renderList(keyword = "") {
  const k = keyword.trim();
  const items = QIAN.map((_, i) => qianOf(i + 1)).filter((q) => !k || String(q.num) === k || q.ganzhi.includes(k) || q.poem.join("").includes(k) || qianNumber(q.num) === k);
  $("#qian-list").replaceChildren(...items.map((q) => {
    const d = el("details", "qian-item", [
      el("summary", null, [el("span", "qian-item-no", `第${qianNumber(q.num)}籤 ${q.ganzhi}`), el("span", `tone ${LEVELS[q.level].tier}`, QIAN_GRADES[q.level]), el("span", "qian-item-first", q.poem[0].replace(/[，。]/, ""))]),
    ]);
    d.addEventListener("toggle", () => {
      if (d.open && d.children.length === 1) {
        d.append(el("p", "qian-item-poem", q.poem.join("")), el("p", null, q.plain), el("p", "hint", `典故：${q.stories.join("、")}`));
      }
    }, { once: false });
    return d;
  }));
}

// ── 初始化 ──
const TOPIC_CHOICES = [["auto", "自動判斷"], ["love", "感情"], ["career", "事業"], ["money", "財運"], ["study", "學業"], ["health", "健康"], ["travel", "出行"], ["general", "其他"]];
$("#topics").append(...TOPIC_CHOICES.map(([key, label]) => {
  const b = el("button", key === topic ? "active" : "", label);
  b.type = "button";
  b.addEventListener("click", () => {
    topic = key;
    $("#topics").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  });
  return b;
}));
$("#tube .sticks").append(...Array.from({ length: 9 }, (_, i) => {
  const s = el("i");
  s.style.setProperty("--i", i);
  return s;
}));
$("#btn-clear").addEventListener("click", () => {
  if (!confirm("確定要清除所有求籤紀錄嗎？")) return;
  try { localStorage.removeItem(QIAN_HISTORY_KEY); } catch { /* 忽略 */ }
  renderHistory();
});
$("#search").addEventListener("input", (e) => renderList(e.target.value));
resetRitual();
renderHistory();
renderList();
