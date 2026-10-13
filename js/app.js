// 畫面與互動。起卦邏輯在 divination.js，解讀文字在 reading.js，納甲在 najia.js。

const $ = (selector) => document.querySelector(selector);
const METHOD_NAMES = { coin: "金錢卦", yarrow: "蓍草法", meihua: "梅花易數" };
const STEP_HINTS = {
  coin: "擲三枚銅錢六次，由初爻起到上爻。正面記 3、反面記 2：6 老陰、7 少陽、8 少陰、9 老陽；老陰老陽為動爻。",
  yarrow: "大衍之數五十，其用四十有九。分二、掛一、揲四、歸奇，三變得一爻，十八變成一卦。",
};
const VALUE_NAMES = { 6: "老陰", 7: "少陽", 8: "少陰", 9: "老陽" };
const TOPIC_CHOICES = [
  ["auto", "自動判斷"], ["love", "感情"], ["career", "事業"], ["money", "財運"],
  ["study", "學業"], ["health", "健康"], ["travel", "出行"], ["general", "其他"],
];
const ACCURACY_CHOICES = [["yes", "準"], ["no", "不準"], ["", "還不知道"]];
const HISTORY_KEY = "iching-history";
const SOUND_KEY = "iching-sound";
const HISTORY_LIMIT = 200;

// 使用者若在系統設定了「減少動態效果」，就跳過等待與動畫
const CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, CALM ? 0 : ms));

let method = "coin";
let topic = "auto";
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

function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕模式等情況下存不了就算了，不影響占卜
  }
}

// ── 音效與震動 ── 用 Web Audio 直接合成，不需要音檔
let soundOn = readStore(SOUND_KEY, "on") === "on";
let audioContext = null;

function tone(frequency, delay, duration, volume, type = "sine") {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  } catch {
    // 瀏覽器不支援或被擋下就靜音
  }
}

const buzz = (ms) => { if (soundOn && navigator.vibrate) navigator.vibrate(ms); };

// 三枚銅錢先後落地的清脆聲
function playCoins(delay) {
  for (let i = 0; i < 3; i++) {
    tone(2500 + i * 380, delay + i * 0.07, 0.2, 0.1, "triangle");
    tone(5100 + i * 450, delay + i * 0.07, 0.08, 0.04);
  }
  setTimeout(() => buzz(25), delay * 1000);
}
const playStalks = () => tone(600 + Math.random() * 300, 0, 0.07, 0.05, "triangle");
// 卦成時的一聲磬
function playReveal() {
  tone(196, 0, 1.8, 0.16);
  tone(294, 0, 1.3, 0.07);
  tone(588, 0, 0.6, 0.03);
  buzz(60);
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
    playCoins(0);
    return;
  }
  playCoins(duration / 1000 - 0.08);
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
    playStalks();
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
  try {
    do {
      await castOneLine(all);
    } while (all && pending.length < 6);
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
function readingSection(reading) {
  const head = el("div", "reading-head", [
    el("h4", null, "卦象解讀"),
    el("span", `tone ${reading.tone.tier}`, reading.tone.label),
  ]);
  const body = reading.sections.map((section, i) => {
    const block = el("div", "reading-part", [el("h5", null, section.title), el("p", null, section.text)]);
    block.style.setProperty("--n", i);
    return block;
  });
  return el("div", "reading", [head, ...body]);
}

// ── 六爻納甲區塊 ──
function najiaSection(entry, result) {
  const chart = najiaChart(result, new Date(entry.time));
  const topicKey = detectTopic(entry.question, entry.topic).key;
  const reading = najiaReading(chart, topicKey);
  const { calendar } = chart;

  const table = el("div", "najia-table");
  for (const line of [...chart.lines].reverse()) {
    table.append(el("div", `najia-row${line.moving ? " moving" : ""}`, [
      el("span", "najia-spirit", line.spirit),
      el("span", "najia-rel", `${line.relative} ${line.stem}${line.branch}${line.element}`),
      lineBar(result.values[line.index]),
      el("span", "najia-mark", (line.world ? "世" : line.response ? "應" : "") + (line.empty ? " 空" : "")),
      el("span", "najia-change", line.change ? `→ ${line.change.relative} ${line.change.branch}${line.change.element}` : ""),
    ]));
  }

  const section = el("section", "card najia");
  section.append(
    el("h3", null, "六爻納甲"),
    el("p", "meta", `${calendar.year}年 ${calendar.month}月 ${calendar.day}日 ${calendar.hour}時 · 旬空 ${calendar.empty.join("")}`),
    el("p", "meta", `${chart.palace}宮（${chart.palaceElement}）${chart.generationName}卦`
      + (chart.hidden.length ? ` · 伏神：${chart.hidden.map((h) => `${h.relative}${h.branch}${h.element}伏${POSITION_NAMES[h.index]}爻`).join("、")}` : "")),
    table,
    el("div", "guide", [
      el("h4", null, "用神判讀"),
      el("p", null, reading.note),
      ...reading.paragraphs.map((text) => el("p", null, text)),
      reading.verdict ? el("p", "najia-verdict", reading.verdict) : null,
    ]),
    el("p", "hint", "這裡只套用納甲最基本的規則（用神旺衰、動變、旬空、世應），沒有納入三合、六合、進退神、月破等細則，請當作參考。")
  );
  return section;
}

// ── 事後紀錄：備註與準不準 ──
function reviewSection(entry) {
  const note = el("textarea");
  note.rows = 3;
  note.placeholder = "之後事情怎麼發展？寫下來，日後回頭看。";
  note.value = entry.memo || "";
  note.addEventListener("change", () => {
    entry.memo = note.value.trim();
    updateHistory(entry.time, { memo: entry.memo });
  });

  const buttons = el("div", "choices", ACCURACY_CHOICES.map(([value, label]) => {
    const button = el("button", (entry.accuracy || "") === value ? "active" : "", label);
    button.addEventListener("click", () => {
      entry.accuracy = value;
      updateHistory(entry.time, { accuracy: value });
      buttons.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
    });
    return button;
  }));

  return el("section", "card review", [
    el("h3", null, "事後紀錄"),
    el("p", "hint", "這一卦後來準不準？紀錄會存在這台裝置的占卜紀錄裡。"),
    buttons,
    note,
  ]);
}

// ── 存成圖片 ── 把問題、卦象和結論畫到畫布上（共用的畫布工具在 poster.js）
function drawHexagram(ctx, values, centerX, top, width, colors) {
  const height = 22, gap = 16;
  values.slice().reverse().forEach((value, row) => {
    const y = top + row * (height + gap);
    ctx.fillStyle = isMoving(value) ? colors.accent : colors.ink;
    const piece = (x, w) => { posterRoundRect(ctx, x, y, w, height, 11); ctx.fill(); };
    if (isYang(value)) {
      piece(centerX - width / 2, width);
    } else {
      const part = width * 0.43;
      piece(centerX - width / 2, part);
      piece(centerX + width / 2 - part, part);
    }
    if (isMoving(value)) {
      ctx.font = "28px serif";
      ctx.textAlign = "left";
      ctx.fillText(value === 9 ? "○" : "✕", centerX + width / 2 + 14, y + height - 1);
    }
  });
  return top + 6 * (height + gap);
}

function ichingPoster(entry, result, reading) {
  const { canvas, ctx, colors } = createPoster("iching", `${METHOD_NAMES[entry.method]} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 50px ${POSTER_SERIF}`;
  let y = posterWrap(ctx, entry.question ? `問：${entry.question}` : "卦象", 540, 210, 900, 66, 2);

  // 本卦（與變卦）
  const figures = [{ hex: result.primary, values: result.values, caption: "本卦" }];
  if (result.changed) figures.push({ hex: result.changed, values: result.changed.bits.map((b) => (b ? 7 : 8)), caption: "變卦" });
  const top = y + 80;
  posterPanel(ctx, colors, 96, top - 70, 888, 400);
  figures.forEach((figure, i) => {
    const centerX = figures.length === 1 ? 540 : 300 + i * 480;
    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.font = `26px ${POSTER_SANS}`;
    ctx.fillText(figure.caption, centerX, top - 24);
    const bottom = drawHexagram(ctx, figure.values, centerX, top, 240, colors);
    ctx.textAlign = "center";
    ctx.fillStyle = colors.ink;
    ctx.font = `700 46px ${POSTER_SERIF}`;
    ctx.fillText(figure.hex.fullName, centerX, bottom + 46);
    y = bottom + 46;
  });
  if (figures.length === 2) {
    ctx.fillStyle = colors.muted;
    ctx.font = `48px ${POSTER_SERIF}`;
    ctx.fillText("→", 540, top + 120);
  }

  // 吉凶與結論
  y += 110;
  ctx.fillStyle = colors.accent;
  ctx.font = `700 46px ${POSTER_SERIF}`;
  ctx.fillText(`【${reading.tone.label}】`, 540, y);
  ctx.fillStyle = colors.ink;
  ctx.font = `34px ${POSTER_SANS}`;
  ctx.textAlign = "left";
  posterWrap(ctx, reading.sections[0].text, 110, y + 74, 860, 54, 7);
  return canvas;
}
// ── 顯示結果 ──
// isNew：剛起出的卦（要存紀錄、播放浮現動畫）；從紀錄重看時為 false
function showReading(reading, isNew = true) {
  const entry = isNew ? { ...reading, question: $("#question").value.trim(), topic, time: Date.now() } : reading;
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
  const composed = composeReading(entry, result, guide);
  const shareButton = posterButton(() => ichingPoster(entry, result, composed), `觀象-${result.primary.name}卦.png`);
  summary.append(tips, readingSection(composed), el("div", "actions summary-actions", [shareButton]));
  container.append(summary, najiaSection(entry, result), reviewSection(entry));

  // 辭文
  container.append(hexTexts(result, "primary", guide, "本卦"));
  if (result.changed) container.append(hexTexts(result, "changed", guide, "變卦"));

  container.hidden = false;
  if (isNew) {
    saveHistory(entry);
    playReveal();
  }
  container.scrollIntoView({ behavior: CALM ? "auto" : "smooth", block: "start" });
}

// ── 占卜紀錄（存在瀏覽器的 localStorage）──
function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function storeHistory(history) {
  writeStore(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  renderHistory();
}

function saveHistory(entry) {
  storeHistory([entry, ...loadHistory()]);
}

// 用起卦時間找到那一筆紀錄並補上資料（備註、準不準）
function updateHistory(time, patch) {
  storeHistory(loadHistory().map((entry) => (entry.time === time ? { ...entry, ...patch } : entry)));
}

// 一筆紀錄至少要有合法的六個爻值、起卦方式和時間
function isValidEntry(entry) {
  return entry && typeof entry === "object"
    && Array.isArray(entry.values) && entry.values.length === 6
    && entry.values.every((value) => [6, 7, 8, 9].includes(value))
    && METHOD_NAMES[entry.method] && Number.isFinite(entry.time)
    && (entry.method !== "meihua" || entry.values.filter(isMoving).length === 1);
}

function exportHistory() {
  const blob = new Blob([JSON.stringify(loadHistory(), null, 2)], { type: "application/json" });
  downloadBlob(blob, `觀象-占卜紀錄-${new Date().toISOString().slice(0, 10)}.json`);
}

// 匯入：和現有紀錄合併，同一時間的視為同一筆（以現有的為準）
async function importHistory(file) {
  const status = $("#history-status");
  try {
    const incoming = JSON.parse(await file.text());
    if (!Array.isArray(incoming)) throw new Error();
    const valid = incoming.filter(isValidEntry).map((entry) => ({
      method: entry.method, values: entry.values, time: entry.time,
      question: String(entry.question || "").slice(0, 60), topic: String(entry.topic || "auto"),
      note: entry.note ? String(entry.note) : undefined,
      memo: entry.memo ? String(entry.memo) : undefined,
      accuracy: ["yes", "no"].includes(entry.accuracy) ? entry.accuracy : "",
    }));
    const existing = loadHistory();
    const known = new Set(existing.map((entry) => entry.time));
    const added = valid.filter((entry) => !known.has(entry.time));
    storeHistory([...existing, ...added].sort((a, b) => b.time - a.time));
    status.textContent = `匯入 ${added.length} 筆` + (valid.length - added.length ? `，${valid.length - added.length} 筆已存在` : "")
      + (incoming.length - valid.length ? `，${incoming.length - valid.length} 筆格式不符已略過` : "") + "。";
  } catch {
    status.textContent = "這個檔案不是有效的占卜紀錄。";
  }
}

function renderHistory() {
  const history = loadHistory();
  $("#history-list-wrap").hidden = history.length === 0;
  const marked = history.filter((entry) => entry.accuracy);
  const hits = marked.filter((entry) => entry.accuracy === "yes").length;
  $("#history-stats").textContent = history.length
    ? `共 ${history.length} 筆` + (marked.length ? `，已回報 ${marked.length} 筆，其中 ${hits} 筆準` : "")
    : "還沒有紀錄。";
  $("#history").replaceChildren(...history.map((entry) => {
    const result = interpret(entry.values);
    const label = result.changed
      ? `${result.primary.fullName} 之 ${result.changed.fullName}`
      : result.primary.fullName;
    const mark = entry.accuracy === "yes" ? " · 準" : entry.accuracy === "no" ? " · 不準" : "";
    const button = el("button", "history-item", [
      el("span", "history-hex", `${result.primary.symbol} ${label}`),
      el("span", "history-q", entry.question || "（未寫下問題）"),
      el("span", "history-time", `${METHOD_NAMES[entry.method]}${mark} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`),
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

function renderSoundButton() {
  $("#btn-sound").textContent = `音效震動：${soundOn ? "開" : "關"}`;
}

$("#topics").append(...TOPIC_CHOICES.map(([key, label]) => {
  const button = el("button", key === topic ? "active" : "", label);
  button.type = "button";
  button.addEventListener("click", () => {
    topic = key;
    $("#topics").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
  });
  return button;
}));

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => selectMethod(tab.dataset.method)));
$("#btn-step").addEventListener("click", () => cast(false));
$("#btn-all").addEventListener("click", () => cast(true));
$("#btn-time").addEventListener("click", () => castMeihua(true));
$("#btn-numbers").addEventListener("click", () => castMeihua(false));
$("#btn-sound").addEventListener("click", () => {
  soundOn = !soundOn;
  writeStore(SOUND_KEY, soundOn ? "on" : "off");
  renderSoundButton();
});
$("#btn-export").addEventListener("click", exportHistory);
$("#btn-import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importHistory(file);
  event.target.value = "";
});
$("#btn-clear").addEventListener("click", () => {
  // 按兩次才真的清除，避免誤觸
  const button = $("#btn-clear");
  if (button.dataset.armed) {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* 忽略 */ }
    delete button.dataset.armed;
    button.textContent = "清除";
    renderHistory();
  } else {
    button.dataset.armed = "1";
    button.textContent = "再按一次確定清除";
    setTimeout(() => { delete button.dataset.armed; button.textContent = "清除"; }, 4000);
  }
});

renderSoundButton();
selectMethod("coin");
renderHistory();
