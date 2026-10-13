// 畫面與互動。起卦邏輯在 divination.js，解讀文字在 reading.js。

const $ = (selector) => document.querySelector(selector);
const METHOD_NAMES = { coin: "金錢卦", yarrow: "蓍草法", meihua: "梅花易數" };
const STEP_HINTS = {
  coin: "擲三枚銅錢六次，由初爻起到上爻。正面記 3、反面記 2：6 老陰、7 少陽、8 少陰、9 老陽；老陰老陽為動爻。",
  yarrow: "大衍之數五十，其用四十有九。分二、掛一、揲四、歸奇，三變得一爻，十八變成一卦。",
};
const VALUE_NAMES = { 6: "老陰", 7: "少陽", 8: "少陰", 9: "老陽" };
const HISTORY_KEY = "iching-history";

// 使用者若在系統設定了「減少動態效果」，就跳過等待與動畫
const CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, CALM ? 0 : ms));

let method = "coin";
let pending = []; // 金錢卦／蓍草法逐爻起卦時，已得到的爻
let busy = false; // 動畫進行中，暫時不接受再按

// 小工具：建立元素。el("p", "hint", "文字") 或 el("div", "card", [子元素…])
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

// ── 起卦動畫 ──
function buildStage() {
  const stage = $("#stage");
  if (method === "coin") {
    stage.className = "stage coins";
    stage.replaceChildren(...[0, 1, 2].map(() =>
      el("div", "coin", [el("div", "coin-inner", [el("span", "face front", "正"), el("span", "face back", "反")])])
    ));
  } else {
    stage.className = "stage yarrow";
    stage.replaceChildren(
      el("div", "stalks", Array.from({ length: 49 }, () => el("i", "stalk"))),
      el("p", "stalk-note", "四十九策")
    );
  }
}

// 三枚銅錢拋起翻轉，落下時停在擲出的那一面
async function animateCoins(line, fast) {
  const duration = fast ? 420 : 900;
  const coins = [...document.querySelectorAll("#stage .coin")];
  if (CALM) {
    coins.forEach((coin, i) => {
      coin.firstChild.style.transform = `rotateX(${line.coins[i] === 3 ? 0 : 180}deg)`;
    });
    return;
  }
  await Promise.all(coins.map((coin, i) => {
    const inner = coin.firstChild;
    const from = Number(inner.dataset.angle || 0);
    const to = 1440 + (line.coins[i] === 3 ? 0 : 180);
    inner.dataset.angle = to % 360;
    const timing = { duration, delay: i * 70, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" };
    coin.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-52px)" }, { transform: "translateY(0)" }],
      { ...timing, easing: "ease-in-out" }
    );
    const spin = inner.animate([{ transform: `rotateX(${from}deg)` }, { transform: `rotateX(${to}deg)` }], timing);
    // 分頁在背景時瀏覽器會暫停動畫，所以另外設一個時限，免得卡住不動
    return Promise.race([spin.finished, sleep(duration + 400)]);
  }));
}

// 蓍草：每一變先分成兩堆，再取走歸奇的幾策
async function animateYarrow(line, fast) {
  const pause = fast ? 110 : 380;
  const stalks = [...document.querySelectorAll("#stage .stalk")];
  const note = $("#stage .stalk-note");
  stalks.forEach((stalk) => stalk.classList.remove("gone", "gap"));
  let remaining = 49;
  for (let change = 0; change < 3; change++) {
    const split = stalks[Math.floor(remaining * (0.35 + Math.random() * 0.3))];
    split.classList.add("gap");
    note.textContent = `第${"一二三"[change]}變：分二、掛一、揲四…`;
    await sleep(pause);
    for (let i = remaining - line.removed[change]; i < remaining; i++) stalks[i].classList.add("gone");
    remaining -= line.removed[change];
    split.classList.remove("gap");
    note.textContent = `第${"一二三"[change]}變：去 ${line.removed[change]} 策，餘 ${remaining} 策`;
    await sleep(pause);
  }
  note.textContent = `餘 ${remaining} 策，四四數之得 ${line.value}（${VALUE_NAMES[line.value]}）`;
}

// ── 逐爻起卦（金錢卦、蓍草法）──
async function castOneLine(fast) {
  const line = method === "coin" ? castCoinLine() : castYarrowLine();
  await (method === "coin" ? animateCoins(line, fast) : animateYarrow(line, fast));
  pending.push(line);
  renderProgress();
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("#ask button").forEach((button) => { button.disabled = value; });
}

function renderProgress() {
  $("#progress").replaceChildren(...pending.map((line, i) =>
    el("li", null, [
      el("span", "pos", `${POSITION_NAMES[i]}爻`),
      el("span", "detail", line.detail),
      el("span", "value", `${line.value} ${VALUE_NAMES[line.value]}`),
      lineBar(line.value),
    ])
  ));
  $("#btn-step").textContent = `起${POSITION_NAMES[pending.length % 6]}爻`;
}

// 起一爻（all 為 true 時一路起到上爻）
async function cast(all) {
  if (busy) return;
  setBusy(true);
  const started = method;
  try {
    do {
      await castOneLine(all);
    } while (all && pending.length < 6 && method === started);
    if (pending.length === 6) {
      await sleep(350);
      showReading({ method, values: pending.map((line) => line.value) });
      pending = [];
      renderProgress();
    }
  } finally {
    setBusy(false);
  }
}

// ── 梅花易數 ──
async function castMeihua(byTime) {
  if (busy) return;
  const error = $("#meihua-error");
  error.hidden = true;
  try {
    let result;
    if (byTime) {
      result = castMeihuaByTime();
    } else {
      const a = Number($("#num-a").value);
      const b = Number($("#num-b").value);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) {
        throw new Error("請輸入兩個正整數。");
      }
      result = castMeihuaByNumbers(a, b);
    }
    // 太極轉一會兒再揭曉
    setBusy(true);
    $("#meihua-stage").hidden = false;
    await sleep(1100);
    $("#meihua-stage").hidden = true;
    showReading({ method: "meihua", values: result.values, note: result.note });
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    setBusy(false);
  }
}

// ── 卦象繪製 ──
// 一條爻：陽爻一長橫、陰爻兩短橫；動爻在右側標 ○（老陽）或 ✕（老陰）
function lineBar(value) {
  const bar = el("span", `bar ${isYang(value) ? "yang" : "yin"}${isMoving(value) ? " moving" : ""}`);
  bar.append(el("i"), el("i"));
  if (isMoving(value)) bar.append(el("b", null, value === 9 ? "○" : "✕"));
  return bar;
}

// 整個卦：values 由初爻到上爻，畫的時候上爻在最上面。
// order 是第幾個出現的卦，用來讓本卦、互卦、變卦依序浮現。
function hexFigure(hex, values, caption, order) {
  const figure = el("figure", "hex");
  figure.style.setProperty("--base", `${order * 800}ms`);
  const bars = values.map((value, i) => {
    const bar = lineBar(value);
    bar.style.setProperty("--i", i); // 初爻先畫，由下往上
    return bar;
  });
  const up = TRIGRAMS[hex.upper];
  const low = TRIGRAMS[hex.lower];
  figure.append(
    el("figcaption", "caption", caption),
    el("div", "lines", bars.reverse()),
    el("div", "hex-name", hex.fullName),
    el("div", "hex-meta", `第 ${hex.number} 卦 · 上${hex.upper}${up.symbol} 下${hex.lower}${low.symbol}`)
  );
  return figure;
}

// ── 卦辭、爻辭 ──
function textBlock(title, text, plain, mark) {
  const block = el("div", `text${mark ? " " + mark : ""}`);
  block.append(el("h4", null, title), el("p", "classic", text));
  if (plain) block.append(el("p", "plain", plain));
  return block;
}

// hexKey 是 "primary" 或 "changed"，用來對照 readingGuide 回傳的重點
function hexTexts(result, hexKey, guide, heading) {
  const hex = result[hexKey];
  const markOf = (part) => {
    const hit = guide.focus.find((f) => f.hex === hexKey && f.part === part);
    return hit ? (hit.main ? "focus main" : "focus") : "";
  };
  const section = el("section", "card texts");
  section.append(el("h3", null, `${heading}：${hex.symbol} ${hex.fullName}`));
  section.append(textBlock("卦辭", `${hex.name}：${hex.judgment}`, hex.judgmentPlain, markOf("judgment")));
  section.append(textBlock("象曰", hex.image, null, ""));
  hex.lines.forEach((line, i) => {
    const title = lineTitle(i, hex.bits[i] === 1);
    const isMovingLine = hexKey === "primary" && result.moving.includes(i);
    section.append(textBlock(title + (isMovingLine ? "（動）" : ""), line.text, line.plain, markOf(i)));
  });
  if (hex.extra) {
    section.append(textBlock(hex.name === "乾" ? "用九" : "用六", hex.extra.text, hex.extra.plain, markOf("extra")));
  }
  return section;
}

// ── 內建解讀區塊 ── 由 reading.js 依規則組出
function readingSection(entry, result, guide) {
  const { tone, sections } = composeReading(entry, result, guide);
  const head = el("div", "reading-head", [
    el("h4", null, "卦象解讀"),
    el("span", `tone ${tone.tier}`, tone.label),
  ]);
  const body = sections.map((section, i) => {
    const block = el("div", "reading-part", [el("h5", null, section.title), el("p", null, section.text)]);
    block.style.setProperty("--n", i);
    return block;
  });
  return el("div", "reading", [head, ...body]);
}
// ── 顯示結果 ──
// isNew：剛起出的卦（要存紀錄、播放浮現動畫）；從紀錄重看時為 false
function showReading(reading, isNew = true) {
  const entry = isNew ? { ...reading, question: $("#question").value.trim(), time: Date.now() } : reading;
  const result = interpret(entry.values);
  const isMeihua = entry.method === "meihua";
  const container = $("#result");
  container.replaceChildren();
  container.classList.toggle("reveal", isNew);

  // 摘要
  const summary = el("section", "card summary");
  summary.append(
    el("p", "meta", `${METHOD_NAMES[entry.method]} · ${new Date(entry.time).toLocaleString("zh-TW")}`),
    el("h2", null, entry.question ? `問：${entry.question}` : "卦象")
  );
  if (entry.note) summary.append(el("p", "hint", entry.note));

  const still = (hex) => hex.bits.map((b) => (b ? 7 : 8));
  const figures = el("div", "figures");
  let order = 0;
  const addFigure = (hex, values, caption) => {
    if (order) {
      const arrow = el("span", "arrow", "→");
      arrow.style.setProperty("--base", `${order * 800 - 200}ms`);
      figures.append(arrow);
    }
    figures.append(hexFigure(hex, values, caption, order++));
  };
  addFigure(result.primary, result.values, "本卦");
  if (isMeihua) addFigure(result.mutual, still(result.mutual), "互卦");
  if (result.changed) addFigure(result.changed, still(result.changed), "變卦");
  summary.append(figures);

  // 解卦重點
  const guide = isMeihua
    ? { tip: `梅花易數以本卦「${lineTitle(result.moving[0], result.bits[result.moving[0]] === 1)}」動爻爻辭為主；本卦看起因，互卦看過程，變卦看結果。`,
        focus: [{ hex: "primary", part: result.moving[0], main: true }] }
    : readingGuide(result);
  const tips = el("div", "guide", [el("h4", null, "解卦重點"), el("p", null, guide.tip)]);
  if (isMeihua) {
    const t = tiYong(result);
    tips.append(el("p", null,
      `體卦 ${t.ti}（${t.tiElement}）代表自己，用卦 ${t.yong}（${t.yongElement}）代表所問之事：${t.relation}，${t.verdict}`));
  }
  summary.append(tips, readingSection(entry, result, guide));
  container.append(summary);

  // 辭文
  container.append(hexTexts(result, "primary", guide, "本卦"));
  if (result.changed) container.append(hexTexts(result, "changed", guide, "變卦"));

  container.hidden = false;
  if (isNew) saveHistory(entry);
  container.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "start" });
}

// ── 占卜紀錄（存在瀏覽器的 localStorage）──
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function storeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // 無痕模式等情況下存不了就算了，不影響占卜
  }
  renderHistory();
}

function saveHistory(entry) {
  storeHistory([entry, ...loadHistory()].slice(0, 30));
}

function renderHistory() {
  const history = loadHistory();
  $("#history-card").hidden = history.length === 0;
  $("#history").replaceChildren(...history.map((entry) => {
    const result = interpret(entry.values);
    const label = result.changed
      ? `${result.primary.fullName} 之 ${result.changed.fullName}`
      : result.primary.fullName;
    const button = el("button", "history-item", [
      el("span", "history-hex", `${result.primary.symbol} ${label}`),
      el("span", "history-q", entry.question || "（未寫下問題）"),
      el("span", "history-time", `${METHOD_NAMES[entry.method]} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`),
    ]);
    button.addEventListener("click", () => showReading(entry, false));
    return el("li", null, [button]);
  }));
}

// ── 事件 ──
function selectMethod(next) {
  if (busy) return;
  method = next;
  pending = [];
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.method === next));
  $("#panel-step").hidden = next === "meihua";
  $("#panel-meihua").hidden = next !== "meihua";
  if (next !== "meihua") {
    $("#step-hint").textContent = STEP_HINTS[next];
    buildStage();
    renderProgress();
  }
}

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => selectMethod(tab.dataset.method)));
$("#btn-step").addEventListener("click", () => cast(false));
$("#btn-all").addEventListener("click", () => cast(true));
$("#btn-time").addEventListener("click", () => castMeihua(true));
$("#btn-numbers").addEventListener("click", () => castMeihua(false));
$("#btn-clear").addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

selectMethod("coin");
renderHistory();
