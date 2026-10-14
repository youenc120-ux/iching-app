// 塔羅占卜頁：洗牌 → 自己從牌堆抽牌 → 翻牌 → 依牌陣、問法與類別組出解讀。
// 需要 reading.js（問法與類別判斷）、tarot-cards.js、tarot-minor.js、poster.js。

const TAROT_HISTORY_KEY = "tarot-history";
const TAROT_HISTORY_LIMIT = 40;
const TAROT_CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tarotSleep = (ms) => new Promise((resolve) => setTimeout(resolve, TAROT_CALM ? 0 : ms));
const $ = (selector) => document.querySelector(selector);

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

// ── 牌陣 ── weight：算整體吉凶時這個位置佔幾份
const SPREADS = {
  one: {
    name: "單張", hint: "抽一張牌，直接回答你的問題。適合「該不該」「會不會」這類簡單的問題。",
    positions: [{ name: "答案", weight: 1, note: "這張牌就是對你問題的回答。" }],
  },
  three: {
    name: "三張", hint: "過去、現在、未來：看這件事怎麼來的、現在在哪裡、會往哪裡去。",
    positions: [
      { name: "過去", weight: 1, note: "造成現在這個局面的原因。" },
      { name: "現在", weight: 2, note: "你目前真正的處境。" },
      { name: "未來", weight: 2, note: "照目前的方向走下去，會走到哪裡。" },
    ],
  },
  choice: {
    name: "二選一", hint: "在兩個選項之間做決定：各抽一張看選它之後的發展，再抽一張建議。",
    positions: [
      { name: "選 A", weight: 0, note: "選這個之後的發展。" },
      { name: "選 B", weight: 0, note: "選這個之後的發展。" },
      { name: "建議", weight: 1, note: "做決定時該注意的事。" },
    ],
  },
  celtic: {
    name: "凱爾特十字", hint: "十張牌的完整牌陣，適合比較複雜、想看清全貌的問題。",
    positions: [
      { name: "現況", weight: 2, note: "這件事現在的核心狀態。" },
      { name: "阻礙", weight: 1, note: "擋在你面前、和你交叉的力量。" },
      { name: "根源", weight: 1, note: "藏在底下、你不一定意識到的原因。" },
      { name: "過去", weight: 1, note: "正在離開的影響。" },
      { name: "目標", weight: 1, note: "你意識上想要的、最好的可能。" },
      { name: "近未來", weight: 2, note: "接下來不久會發生的事。" },
      { name: "你的態度", weight: 1, note: "你自己面對這件事的方式。" },
      { name: "外在環境", weight: 1, note: "別人、環境對這件事的影響。" },
      { name: "希望與恐懼", weight: 1, note: "你心裡期待又害怕的部分。" },
      { name: "最終結果", weight: 3, note: "照目前所有條件發展的結果。" },
    ],
  },
};

const TOPIC_CHOICES = [["auto", "自動判斷"], ["love", "感情"], ["career", "事業"], ["money", "財運"], ["study", "學業"], ["health", "健康"], ["travel", "出行"], ["general", "其他"]];
// 牌義只分感情、工作、金錢與整體；學業看工作那一面，健康與出行看整體
const TOPIC_FIELD = { love: "love", career: "work", money: "money", study: "work", health: "general", travel: "general", general: "general" };

let topic = "auto";
let spread = "one";
let deck = [];       // 洗好的牌（TAROT 的索引）
let picked = [];     // 已抽的牌 { card: 索引, reversed }
let busy = false;

// ── 亂數 ── 用瀏覽器的密碼學亂數洗牌，比 Math.random 更均勻
function randomInt(n) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}

function shuffled(count) {
  const list = Array.from({ length: count }, (_, i) => i);
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ── 用詞 ── 共用易經的回答句，把「卦」改成「牌」
function tarotWords(text) {
  return (text || "").replace(/卦象/g, "牌面").replace(/辭裡/g, "牌裡").replace(/辭意/g, "牌意").replace(/這一卦/g, "這次的牌").replace(/卦/g, "牌");
}

function cardImage(card, reversed) {
  const img = el("img", reversed ? "reversed" : "");
  img.src = `images/tarot/${card.img}.jpg`;
  img.alt = `${card.name}${reversed ? "（逆位）" : ""}`;
  return img;
}

function cardLabel(p) {
  const card = TAROT[p.card];
  return `${card.name}${p.reversed ? "（逆位）" : "（正位）"}`;
}

function cardSide(p) {
  const card = TAROT[p.card];
  return p.reversed ? card.rev : card.up;
}

function cardLevel(p) {
  return TAROT[p.card].levels[p.reversed ? 1 : 0];
}

// ── 時間 ── 傳統上用花色估快慢：權杖、寶劍快，聖杯中等，錢幣慢；大阿爾克那表示要看大局
function tarotTiming(cards) {
  const count = { wands: 0, swords: 0, cups: 0, pents: 0, major: 0 };
  for (const p of cards) {
    const img = TAROT[p.card].img;
    count[img.startsWith("m") ? "major" : img.replace(/\d+/, "")]++;
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
  const pace = {
    wands: "牌面以權杖為主，事情動得快，大約是幾天到幾週內。",
    swords: "牌面以寶劍為主，變化會很快，但過程有衝突或波折。",
    cups: "牌面以聖杯為主，節奏中等，大約幾週到幾個月。",
    pents: "牌面以錢幣為主，進展慢，以月計，甚至要更久。",
    major: "牌面以大阿爾克那為主，這件事取決於大環境的轉變，不是短期內你能催快的。",
  }[top];
  const slow = cards.filter((p) => p.reversed).length > cards.length / 2 ? "逆位的牌偏多，會比預期再慢一些。" : "";
  return `塔羅不會給確切的日期，傳統上只用花色估快慢。${pace}${slow}`;
}

// ── 組出解讀 ──
function tarotReading(entry) {
  const def = SPREADS[entry.spread];
  const cards = entry.cards;
  const topicInfo = detectTopic(entry.question, entry.topic);
  const field = TOPIC_FIELD[topicInfo.key];
  const form = detectForm(entry.question);
  const sections = [];

  // 整體評等：依位置的份量加權
  let total = 0, weights = 0;
  cards.forEach((p, i) => { total += cardLevel(p) * def.positions[i].weight; weights += def.positions[i].weight; });
  let level = Math.max(1, Math.min(5, Math.round(total / weights)));

  const asked = entry.question ? `你問：「${entry.question}」\n` : "";
  const lines = [];
  const topicText = (p) => cardSide(p)[field] || cardSide(p).general;

  if (entry.spread === "choice") {
    const [a, b, advice] = cards;
    const nameA = entry.options?.[0] || "選項 A", nameB = entry.options?.[1] || "選項 B";
    const la = cardLevel(a), lb = cardLevel(b);
    level = Math.max(la, lb);
    let verdict;
    if (Math.abs(la - lb) >= 1) {
      const [win, lose] = la > lb ? [nameA, nameB] : [nameB, nameA];
      verdict = `選「${win}」比較好。${la > lb ? cardLabel(a) : cardLabel(b)}明顯比${la > lb ? cardLabel(b) : cardLabel(a)}有利。`;
      if (Math.max(la, lb) <= 2) verdict += `不過兩邊都不理想，「${win}」只是比「${lose}」少一點問題，也可以考慮兩個都不選。`;
    } else {
      verdict = `兩個選項的牌面差不多，牌沒有替你分出高下。關鍵在「建議」那張牌點出的事，以及你自己最在乎的是什麼。`;
    }
    lines.push(`${asked}${verdict}`);
    lines.push(`【選「${nameA}」】${cardLabel(a)}：${topicText(a)}`);
    lines.push(`【選「${nameB}」】${cardLabel(b)}：${topicText(b)}`);
    lines.push(`【建議】${cardLabel(advice)}：${cardSide(advice).general}`);
  } else {
    let answer;
    if (form.type === "timing") answer = tarotTiming(cards);
    else if (form.type === "choice") answer = "一次抽牌比較不了兩個選項。要比較的話，請改用「二選一」牌陣，分別寫上兩個選項再抽。先給整體的答案：" + tarotWords(LEVELS[level].verdict);
    else answer = tarotWords(directAnswer(form, level, cards.length));
    lines.push(`${asked}${answer}`);

    // 最關鍵的那張：份量最重的位置
    const keyIndex = def.positions.reduce((best, pos, i) => (pos.weight > def.positions[best].weight ? i : best), 0);
    const key = cards[keyIndex];
    const keyName = def.positions[keyIndex].name;
    lines.push(`【關鍵的牌】${cards.length > 1 ? `「${keyName}」位置的` : ""}${cardLabel(key)}：${topicText(key)}`);

    if (cards.length > 1) {
      const order = cards.map((p, i) => ({ p, i, l: cardLevel(p) }));
      const worst = order.reduce((m, c) => (c.l < m.l ? c : m));
      const best = order.reduce((m, c) => (c.l > m.l ? c : m));
      if (worst.l <= 2 && worst.i !== keyIndex) lines.push(`【最大的阻力】「${def.positions[worst.i].name}」的${cardLabel(worst.p)}：${topicText(worst.p)}`);
      if (best.l >= 4 && best.i !== keyIndex) lines.push(`【可以依靠的】「${def.positions[best.i].name}」的${cardLabel(best.p)}：${topicText(best.p)}`);
    }
  }

  const followTable = FORM_FOLLOWUPS[form.bad ? "outcomeBad" : form.type];
  // 二選一的建議由「建議」那張牌給，不再接通用的句子（會和「選哪個比較好」打架）
  let follow = entry.spread === "choice" ? "" : followTable ? followTable[level] : TOPIC_ADVICE[topicInfo.key][level];
  if (topicInfo.key === "health") follow = level <= 2 ? "牌面不樂觀，但塔羅不是診斷，也不能決定病情。現在最該做的是照醫師的建議積極處理，不要拖。" : `${follow}身體的事以醫師的診斷為準。`;
  if (follow) lines.push(`【具體建議】${tarotWords(follow)}`);
  if (topicInfo.key === "general" && entry.spread !== "choice") lines.push("（在問題下方選「感情」「事業」等類別，牌義會換成那一類的解釋。）");
  sections.push({ title: "直說", text: lines.join("\n") });

  // 每一張牌
  sections.push({
    title: "逐張解讀",
    cards: cards.map((p, i) => {
      const pos = def.positions[i];
      const name = entry.spread === "choice" && i < 2 ? `選「${entry.options?.[i] || (i ? "選項 B" : "選項 A")}」` : pos.name;
      const side = cardSide(p);
      const parts = [`${pos.note}`, side.general];
      if (field !== "general") parts.push(`放到${topicInfo.name}上：${side[field]}`);
      return { position: name, p, keywords: side.keywords, text: parts.join("\n") };
    }),
  });

  // 整體的牌面
  const majors = cards.filter((p) => TAROT[p.card].img.startsWith("m")).length;
  const reversed = cards.filter((p) => p.reversed).length;
  const notes = [];
  if (cards.length >= 3) {
    if (majors / cards.length >= 0.5) notes.push(`大阿爾克那有 ${majors} 張，佔了一半以上：這件事牽涉的是人生方向或你控制不了的大局，不是小事。`);
    else if (majors === 0) notes.push("沒有大阿爾克那：這是日常層面的事，結果大多掌握在你自己的行動上。");
    const suits = { wands: 0, cups: 0, swords: 0, pents: 0 };
    cards.forEach((p) => { const s = TAROT[p.card].img.replace(/\d+/, ""); if (s in suits) suits[s]++; });
    const [suit, n] = Object.entries(suits).sort((a, b) => b[1] - a[1])[0];
    const meaning = { wands: "行動和事業的熱情", cups: "感情與人際", swords: "思考、衝突與壓力", pents: "錢、工作和現實條件" };
    if (n >= 2) notes.push(`花色以${SUIT_NAMES[suit]}最多（${n} 張）：這件事的重心在${meaning[suit]}。`);
  }
  if (cards.length > 1 && reversed > cards.length / 2) notes.push(`逆位有 ${reversed} 張，超過一半：能量受阻、事情卡住，或你在逃避某些面向。`);
  if (notes.length) sections.push({ title: "整體牌面", text: notes.join("\n") });

  return { level, tone: LEVELS[level], sections };
}

// ── 畫面 ──
function renderSpreadTabs() {
  $("#spreads").replaceChildren(...Object.entries(SPREADS).map(([key, def]) => {
    const tab = el("button", `tab${key === spread ? " active" : ""}`, def.name);
    tab.type = "button";
    tab.addEventListener("click", () => {
      if (busy) return;
      spread = key;
      renderSpreadTabs();
    });
    return tab;
  }));
  $("#spread-hint").textContent = SPREADS[spread].hint;
  $("#choice-options").hidden = spread !== "choice";
  // 問題寫成「A 還是 B」時，幫忙填進兩個選項
  if (spread === "choice" && !$("#option-a").value && !$("#option-b").value) {
    const parts = $("#question").value.replace(/[？?。]/g, "").split(/還是|或是|或者/);
    if (parts.length === 2) {
      $("#option-a").value = parts[0].replace(/^(我)?(該|要|應該)?(選)?/, "").trim().slice(0, 20);
      $("#option-b").value = parts[1].trim().slice(0, 20);
    }
  }
}

function slotClass(spreadKey, i) {
  return spreadKey === "celtic" ? `slot c${i + 1}` : "slot";
}

async function startShuffle() {
  if (busy) return;
  busy = true;
  picked = [];
  deck = shuffled(TAROT.length);
  $("#result").hidden = true;
  $("#draw").hidden = false;
  const need = SPREADS[spread].positions.length;
  $("#draw-status").textContent = "洗牌中……";
  $("#deck-fan").replaceChildren();
  const pile = $("#deck-shuffle");
  pile.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const back = el("div", "card-back");
    back.style.setProperty("--i", i);
    return back;
  }));
  pile.hidden = false;
  pile.classList.add("shuffling");
  $("#draw").scrollIntoView({ behavior: TAROT_CALM ? "auto" : "smooth", block: "start" });
  await tarotSleep(1600);
  pile.classList.remove("shuffling");
  pile.hidden = true;

  // 攤開的牌堆：每張牌背對應洗好的牌序裡的一張
  $("#deck-fan").replaceChildren(...deck.map((cardIndex, i) => {
    const back = el("button", "card-back fan");
    back.type = "button";
    back.style.setProperty("--i", i);
    back.setAttribute("aria-label", `第 ${i + 1} 張`);
    back.addEventListener("click", () => pickCard(back, cardIndex));
    return back;
  }));
  $("#draw-status").textContent = `憑直覺抽 ${need} 張牌（已抽 0 張）`;
  busy = false;
}

function pickCard(back, cardIndex) {
  const need = SPREADS[spread].positions.length;
  if (busy || picked.length >= need || back.classList.contains("taken")) return;
  back.classList.add("taken");
  back.disabled = true;
  const reversed = $("#allow-reversed").checked && randomInt(2) === 1;
  picked.push({ card: cardIndex, reversed });
  $("#draw-status").textContent = `憑直覺抽 ${need} 張牌（已抽 ${picked.length} 張）`;
  if (navigator.vibrate) navigator.vibrate(12);
  if (picked.length === need) finishDraw();
}

function autoPick() {
  const backs = [...$("#deck-fan").querySelectorAll(".card-back:not(.taken)")];
  const need = SPREADS[spread].positions.length - picked.length;
  for (let i = 0; i < need && backs.length; i++) {
    const back = backs.splice(randomInt(backs.length), 1)[0];
    back.click();
  }
}

async function finishDraw() {
  busy = true;
  await tarotSleep(350);
  const entry = {
    question: $("#question").value.trim(),
    topic, spread,
    options: spread === "choice" ? [$("#option-a").value.trim(), $("#option-b").value.trim()] : undefined,
    cards: picked,
    reversals: $("#allow-reversed").checked,
    time: Date.now(),
  };
  $("#draw").hidden = true;
  saveTarotHistory(entry);
  await showTarot(entry, true);
  busy = false;
}

async function showTarot(entry, animate) {
  const def = SPREADS[entry.spread];
  const container = $("#result");
  container.replaceChildren();
  container.hidden = false;

  const summary = el("section", "card summary");
  summary.append(
    el("p", "meta", `${def.name}牌陣 · ${new Date(entry.time).toLocaleString("zh-TW")}${entry.reversals ? "" : " · 不用逆位"}`),
    el("h2", null, entry.question ? `問：${entry.question}` : "塔羅")
  );

  // 牌陣：先放牌背，再一張張翻開
  const table = el("div", `tarot-table spread-${entry.spread}`);
  const slots = entry.cards.map((p, i) => {
    const card = TAROT[p.card];
    const label = entry.spread === "choice" && i < 2 ? (entry.options?.[i] || (i ? "選項 B" : "選項 A")) : def.positions[i].name;
    const flip = el("div", "flip", [el("div", "face back card-back"), el("div", "face front", [cardImage(card, p.reversed)])]);
    const slot = el("figure", slotClass(entry.spread, i), [flip, el("figcaption", null, [el("span", "slot-pos", `${i + 1}. ${label}`), el("span", "slot-name", cardLabel(p))])]);
    return slot;
  });
  table.append(...slots);
  summary.append(table);
  container.append(summary);
  container.scrollIntoView({ behavior: TAROT_CALM ? "auto" : "smooth", block: "start" });

  for (const slot of slots) {
    if (animate) await tarotSleep(entry.cards.length > 3 ? 260 : 520);
    slot.classList.add("open");
  }
  if (animate) await tarotSleep(500);

  const reading = tarotReading(entry);
  const head = el("div", "reading-head", [el("h4", null, "牌面解讀"), el("span", `tone ${reading.tone.tier}`, reading.tone.label)]);
  const parts = reading.sections.map((section, i) => {
    const block = el("div", "reading-part", [el("h5", null, section.title)]);
    if (section.cards) {
      block.append(...section.cards.map((c) => el("div", "tarot-detail", [
        cardImage(TAROT[c.p.card], c.p.reversed),
        el("div", null, [
          el("p", "tarot-detail-head", `${c.position}　${cardLabel(c.p)}`),
          el("p", "tarot-keywords", c.keywords),
          el("p", null, c.text),
        ]),
      ])));
    } else {
      block.append(el("p", null, section.text));
    }
    block.style.setProperty("--n", i);
    return block;
  });
  const poster = posterButton(() => tarotPoster(entry, reading), `觀象-塔羅-${new Date(entry.time).toISOString().slice(0, 10)}.png`);
  summary.append(el("div", `reading${animate ? " reveal" : ""}`, [head, ...parts]), el("div", "actions summary-actions", [poster]));
}

// ── 存成圖片 ──
function tarotPoster(entry, reading) {
  const { canvas, ctx, colors } = createPoster("tarot", `塔羅 · ${SPREADS[entry.spread].name} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 46px ${POSTER_SERIF}`;
  let y = posterWrap(ctx, entry.question ? `問：${entry.question}` : "塔羅", 540, 200, 900, 62, 2);

  // 牌：最多一排五張，十張就兩排
  const n = entry.cards.length;
  const perRow = n > 5 ? 5 : n;
  const rows = Math.ceil(n / perRow);
  const w = n === 1 ? 260 : n <= 3 ? 220 : 150;
  const h = Math.round(w * 1.72);
  const gap = 24;
  const top = y + 40;
  const imgs = [...document.querySelectorAll("#result .tarot-table img")];
  entry.cards.forEach((p, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow);
    const x = 540 - (inRow * w + (inRow - 1) * gap) / 2 + col * (w + gap);
    const cy = top + row * (h + 70);
    const img = imgs[i];
    ctx.save();
    if (p.reversed) { ctx.translate(x + w, cy + h); ctx.rotate(Math.PI); ctx.translate(-x, -cy); }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x, cy, w, h);
    else { ctx.fillStyle = colors.panel; ctx.fillRect(x, cy, w, h); }
    ctx.restore();
    ctx.fillStyle = colors.muted;
    ctx.font = `22px ${POSTER_SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(TAROT[p.card].name + (p.reversed ? "（逆）" : ""), x + w / 2, cy + h + 32);
  });
  y = top + rows * (h + 70) + 40;
  ctx.textAlign = "center";
  ctx.fillStyle = colors.accent;
  ctx.font = `700 42px ${POSTER_SERIF}`;
  ctx.fillText(`【${reading.tone.label}】`, 540, y);
  ctx.fillStyle = colors.ink;
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.textAlign = "left";
  const firstLine = reading.sections[0].text.split("\n").filter((line) => !line.startsWith("你問"))[0] || "";
  posterWrap(ctx, firstLine, 110, y + 60, 860, 46, Math.max(2, Math.floor((1230 - y - 60) / 46)));
  return canvas;
}

// ── 紀錄 ──
function loadTarotHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(TAROT_HISTORY_KEY));
    return Array.isArray(list) ? list.filter((e) => e && SPREADS[e.spread] && Array.isArray(e.cards)
      && e.cards.length === SPREADS[e.spread].positions.length && e.cards.every((p) => TAROT[p.card])) : [];
  } catch {
    return [];
  }
}

function saveTarotHistory(entry) {
  try {
    localStorage.setItem(TAROT_HISTORY_KEY, JSON.stringify([entry, ...loadTarotHistory()].slice(0, TAROT_HISTORY_LIMIT)));
  } catch { /* 無痕模式等情況存不了，就不存 */ }
  renderTarotHistory();
}

function renderTarotHistory() {
  const list = loadTarotHistory();
  const ul = $("#history");
  ul.replaceChildren(...list.map((entry) => {
    const button = el("button", "history-item", [
      el("span", "history-hex", entry.question || "（沒有寫問題）"),
      el("span", "history-q", entry.cards.map(cardLabel).join("、")),
      el("span", "history-time", `${SPREADS[entry.spread].name} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`),
    ]);
    button.type = "button";
    button.addEventListener("click", () => { if (!busy) showTarot(entry, false); });
    return el("li", null, [button]);
  }));
  if (!list.length) ul.append(el("li", "hint", "還沒有紀錄。"));
}

// ── 初始化 ──
$("#topics").append(...TOPIC_CHOICES.map(([key, label]) => {
  const button = el("button", key === topic ? "active" : "", label);
  button.type = "button";
  button.addEventListener("click", () => {
    topic = key;
    $("#topics").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
  });
  return button;
}));
renderSpreadTabs();
renderTarotHistory();
$("#btn-shuffle").addEventListener("click", startShuffle);
$("#btn-auto").addEventListener("click", autoPick);
$("#btn-clear").addEventListener("click", () => {
  if (!confirm("確定要清除所有塔羅紀錄嗎？")) return;
  try { localStorage.removeItem(TAROT_HISTORY_KEY); } catch { /* 忽略 */ }
  renderTarotHistory();
});
