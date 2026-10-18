// 塔羅占卜頁（對話式）：在對話框裡說出問題 → 依問法自動選牌陣 → 洗牌、切牌、抽牌 → 一張張翻開解讀 → 追問。
// 另有今日塔羅、牌背選擇、月曆紀錄、點牌看牌義。解讀由規則產生，不是 AI。
// 需要 reading.js（問法與類別判斷）、tarot-cards.js、tarot-minor.js、poster.js。

const TAROT_HISTORY_KEY = "tarot-history";
const TAROT_DAILY_KEY = "tarot-daily";
const TAROT_BACK_KEY = "tarot-back";
const TAROT_HISTORY_LIMIT = 80;
const TAROT_CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (selector) => document.querySelector(selector);

let instant = TAROT_CALM; // 重看紀錄時不播動畫
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, instant ? 0 : ms));

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 無痕模式等情況存不了 */ }
}

// ── 牌陣 ── weight：算整體吉凶時這個位置佔幾份；compare：兩個位置互相比較的牌陣
const SPREADS = {
  one: { name: "單張", positions: [{ name: "答案", weight: 1, note: "這張牌就是對你問題的回答。" }] },
  three: {
    name: "過去・現在・未來",
    positions: [
      { name: "過去", weight: 1, note: "造成現在這個局面的原因。" },
      { name: "現在", weight: 2, note: "你目前真正的處境。" },
      { name: "未來", weight: 2, note: "照目前的方向走下去，會走到哪裡。" },
    ],
  },
  doOrNot: {
    name: "做與不做", compare: ["去做", "不做"],
    positions: [
      { name: "去做", weight: 0, note: "如果你去做，事情會怎麼發展。" },
      { name: "不做", weight: 0, note: "如果你不做，事情會怎麼發展。" },
      { name: "建議", weight: 1, note: "做決定時該注意的事。" },
    ],
  },
  choice: {
    name: "二選一", compare: true,
    positions: [
      { name: "選 A", weight: 0, note: "選這個之後的發展。" },
      { name: "選 B", weight: 0, note: "選這個之後的發展。" },
      { name: "建議", weight: 1, note: "做決定時該注意的事。" },
    ],
  },
  mind: {
    name: "對方的心",
    positions: [
      { name: "他現在的想法", weight: 1, note: "對方腦袋裡怎麼看這件事、怎麼看你。" },
      { name: "他對你的感覺", weight: 2, note: "對方心裡真正的感受。" },
      { name: "他接下來的行動", weight: 2, note: "對方接下來比較可能怎麼做。" },
    ],
  },
  how: {
    name: "現況・阻礙・建議",
    positions: [
      { name: "現況", weight: 1, note: "你現在的處境。" },
      { name: "阻礙", weight: 1, note: "卡住你的東西。" },
      { name: "建議", weight: 2, note: "最該做的事。" },
    ],
  },
  celtic: {
    name: "凱爾特十字",
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
const SPREAD_ORDER = ["one", "three", "doOrNot", "choice", "mind", "how", "celtic"];

// 依問法挑牌陣，就像占卜師聽完問題後決定怎麼排牌
function chooseSpread(form, question) {
  if (form.type === "choice") return "choice";
  if (form.type === "decision") return "doOrNot";
  if (form.type === "mind") return "mind";
  if (form.type === "how") return "how";
  if (form.type === "open" && question.length > 22) return "celtic";
  return "three";
}

const FORM_PHRASES = {
  choice: "你在兩個選項之間猶豫", decision: "你想知道該不該做", mind: "你想知道對方的心意",
  how: "你想知道該怎麼做", timing: "你想知道什麼時候", outcome: "你想知道會不會成", state: "你想知道現在的狀況", open: "", none: "",
};

// 牌義只分感情、工作、金錢與整體；學業看工作那一面，健康與出行看整體
const TOPIC_FIELD = { love: "love", career: "work", money: "money", study: "work", health: "general", travel: "general", general: "general" };

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

// ── 牌的小工具 ──
function tarotWords(text) {
  return (text || "").replace(/卦象/g, "牌面").replace(/辭裡/g, "牌裡").replace(/辭意/g, "牌意").replace(/這一卦/g, "這次的牌").replace(/卦/g, "牌");
}
const cardOf = (p) => TAROT[p.card];
const cardSide = (p) => (p.reversed ? cardOf(p).rev : cardOf(p).up);
const cardLevel = (p) => cardOf(p).levels[p.reversed ? 1 : 0];
const cardLabel = (p) => `${cardOf(p).name}${p.reversed ? "（逆位）" : "（正位）"}`;
const isMajor = (p) => cardOf(p).img.startsWith("m");

// 牌組：水墨（本站繪製）、萊德偉特 1909 原版、或每張隨機混合。每張抽到的牌記住自己的牌組，重看紀錄時畫面才會一樣。
const DECKS = [["ink", "水墨"], ["classic", "萊德偉特原版"], ["mix", "隨機混合"]];
const DECK_DIRS = { ink: "tarot-ink", classic: "tarot" };
let deckChoice = (() => { try { return localStorage.getItem("tarot-deck") || "ink"; } catch { return "ink"; } })();
const pickDeck = () => (deckChoice === "mix" ? (randomInt(2) ? "ink" : "classic") : deckChoice);

function cardImage(p) {
  const img = el("img", p.reversed ? "reversed" : "");
  img.src = `images/${DECK_DIRS[p.deck] || DECK_DIRS[deckChoice] || "tarot-ink"}/${cardOf(p).img}.jpg`;
  img.alt = cardLabel(p);
  return img;
}

function positionName(entry, i) {
  const def = SPREADS[entry.spread];
  if (entry.spread === "choice" && i < 2) return `選「${entry.options?.[i] || (i ? "B" : "A")}」`;
  return def.positions[i].name;
}

// ── 時間 ── 傳統上用花色估快慢：權杖、寶劍快，聖杯中等，錢幣慢；大阿爾克那表示要看大局
function tarotTiming(cards) {
  const count = { wands: 0, swords: 0, cups: 0, pents: 0, major: 0 };
  for (const p of cards) count[isMajor(p) ? "major" : cardOf(p).img.replace(/\d+/, "")]++;
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

// ── 組出解讀 ── 回傳 { level, tone, cards: [逐張], summary: [結論的段落], overall: [整體牌面] }
function tarotReading(entry) {
  const def = SPREADS[entry.spread];
  const cards = entry.cards;
  const topic = detectTopic(entry.question, entry.topic);
  const field = TOPIC_FIELD[topic.key];
  const form = detectForm(entry.question);
  const topicText = (p) => cardSide(p)[field] || cardSide(p).general;

  let total = 0, weights = 0;
  cards.forEach((p, i) => { total += cardLevel(p) * def.positions[i].weight; weights += def.positions[i].weight; });
  let level = Math.max(1, Math.min(5, Math.round(total / weights)));

  // 逐張
  const perCard = cards.map((p, i) => {
    const side = cardSide(p);
    const text = [def.positions[i].note, side.general];
    if (field !== "general") text.push(`放到${topic.name}上：${side[field]}`);
    return { position: positionName(entry, i), p, keywords: side.keywords, text: text.join("\n") };
  });

  // 結論
  const summary = [];
  if (def.compare) {
    const [a, b, advice] = cards;
    const names = def.compare === true ? [entry.options?.[0] || "A", entry.options?.[1] || "B"] : def.compare;
    const la = cardLevel(a), lb = cardLevel(b);
    level = Math.max(la, lb);
    if (entry.spread === "doOrNot") {
      if (la - lb >= 1) summary.push(`去做。「去做」那張${cardLabel(a)}明顯比「不做」的${cardLabel(b)}有利。${la <= 2 ? "不過去做也不輕鬆，只是比不做好一點，心理準備要做足。" : ""}`);
      else if (lb - la >= 1) summary.push(`先不要做。「不做」那張${cardLabel(b)}比「去做」的${cardLabel(a)}好，現在去做會吃虧。`);
      else summary.push("做或不做，牌面差不多，沒有哪一邊明顯比較好。這時候看「建議」那張牌，以及你自己最在乎的是什麼。");
    } else {
      if (Math.abs(la - lb) >= 1) {
        const [win, lose, wc, lc] = la > lb ? [names[0], names[1], a, b] : [names[1], names[0], b, a];
        summary.push(`選「${win}」比較好。${cardLabel(wc)}明顯比${cardLabel(lc)}有利。${Math.max(la, lb) <= 2 ? `不過兩邊都不理想，「${win}」只是比「${lose}」少一點問題，也可以考慮都不選。` : ""}`);
      } else {
        summary.push("兩個選項的牌面差不多，牌沒有替你分出高下。關鍵在「建議」那張牌點出的事，以及你自己最在乎的是什麼。");
      }
    }
    summary.push(`【建議】${cardLabel(advice)}：${cardSide(advice).general}${field !== "general" ? cardSide(advice)[field] : ""}`);
  } else {
    if (form.type === "timing") summary.push(tarotTiming(cards));
    else if (form.type === "how") summary.push(`你問的是該怎麼做。整體來看：${tarotWords(LEVELS[level].verdict)}`);
    else if (form.type === "choice") summary.push(`一次看不出兩個選項的高下，下次把兩個選項寫成「A 還是 B」，我會用二選一牌陣。整體來看：${tarotWords(LEVELS[level].verdict)}`);
    else summary.push(tarotWords(directAnswer(form, level, cards.length)));

    const keyIndex = def.positions.reduce((best, pos, i) => (pos.weight > def.positions[best].weight ? i : best), 0);
    const key = cards[keyIndex];
    summary.push(`【關鍵的牌】${cards.length > 1 ? `「${positionName(entry, keyIndex)}」的` : ""}${cardLabel(key)}：${topicText(key)}`);
    if (entry.spread === "how") summary.push(`【怎麼做】${cardSide(cards[2]).general}`);
    if (cards.length > 1) {
      const order = cards.map((p, i) => ({ p, i, l: cardLevel(p) }));
      const worst = order.reduce((m, c) => (c.l < m.l ? c : m));
      const best = order.reduce((m, c) => (c.l > m.l ? c : m));
      if (worst.l <= 2 && worst.i !== keyIndex) summary.push(`【最大的阻力】「${positionName(entry, worst.i)}」的${cardLabel(worst.p)}：${topicText(worst.p)}`);
      if (best.l >= 4 && best.i !== keyIndex) summary.push(`【可以依靠的】「${positionName(entry, best.i)}」的${cardLabel(best.p)}：${topicText(best.p)}`);
    }
    const followTable = FORM_FOLLOWUPS[form.bad ? "outcomeBad" : form.type];
    const follow = followTable ? followTable[level] : TOPIC_ADVICE[topic.key][level];
    if (follow) summary.push(`【建議】${tarotWords(follow)}`);
  }
  if (topic.key === "health") summary.push(level <= 2 ? "牌面不樂觀，但塔羅不是診斷，也不能決定病情。現在最該做的是照醫師的建議積極處理。" : "身體的事以醫師的診斷為準。");

  // 整體牌面
  const overall = [];
  if (cards.length >= 3) {
    const majors = cards.filter(isMajor).length;
    if (majors / cards.length >= 0.5) overall.push(`大阿爾克那有 ${majors} 張，佔了一半以上：這件事牽涉的是人生方向或你控制不了的大局，不是小事。`);
    const suits = { wands: 0, cups: 0, swords: 0, pents: 0 };
    cards.forEach((p) => { const s = cardOf(p).img.replace(/\d+/, ""); if (s in suits) suits[s]++; });
    const [suit, n] = Object.entries(suits).sort((x, y) => y[1] - x[1])[0];
    const meaning = { wands: "行動和事業的熱情", cups: "感情與人際", swords: "思考、衝突與壓力", pents: "錢、工作和現實條件" };
    if (n >= 2 && n / cards.length >= 0.4) overall.push(`${SUIT_NAMES[suit]}有 ${n} 張：這件事的重心在${meaning[suit]}。`);
    const reversed = cards.filter((p) => p.reversed).length;
    if (reversed > cards.length / 2) overall.push(`逆位有 ${reversed} 張，超過一半：能量受阻、事情卡住，或你在逃避某些面向。`);
  }
  return { level, tone: LEVELS[level], topic, form, perCard, summary, overall };
}

// ── 追問 ── 讀完牌之後可以接著問；需要新牌的就從剩下的牌裡再抽一張
const FOLLOWUPS = {
  advice: { label: "那我該怎麼做？", position: "建議", draw: true, pattern: /怎麼做|怎麼辦|該如何|要如何|建議|方法/ },
  mind: { label: "對方現在怎麼想？", position: "對方的想法", draw: true, pattern: /(他|她|對方).*(想|感覺|心|在乎|喜歡)/ },
  outcome: { label: "最後會怎麼樣？", position: "結果", draw: true, pattern: /結果|最後|結局|會怎樣|會怎麼樣/ },
  timing: { label: "多久會有結果？", draw: false, pattern: /多久|什麼時候|何時|幾時|要等/ },
  clarify: { label: "再抽一張補充", position: "補充", draw: true, pattern: /補充|再抽|多抽|看不懂|說清楚/ },
};

function followupText(session, type, p) {
  const topic = detectTopic(session.question, session.topic);
  const field = TOPIC_FIELD[topic.key];
  if (type === "timing") return tarotTiming([...session.cards, ...session.followups.filter((f) => f.card).map((f) => f.card)]);
  const side = cardSide(p);
  const level = cardLevel(p);
  const lines = [`${FOLLOWUPS[type].position}：${cardLabel(p)}`, side.keywords];
  if (type === "advice") {
    lines.push(level >= 4 ? "這張牌支持你主動出手。" : level === 3 ? "這張牌要你先穩住，不急著做大動作。" : "這張牌是警告：先處理它點出的問題，再談往前。");
    lines.push(side.general);
    if (field !== "general") lines.push(`放到${topic.name}上：${side[field]}`);
  } else if (type === "mind") {
    lines.push(tarotWords(FORM_ANSWERS.mind[level]));
    lines.push(`感情面：${side.love}`);
  } else if (type === "outcome") {
    lines.push(tarotWords(FORM_ANSWERS.state[level]).replace("目前的狀況", "最後的結果"));
    lines.push(field !== "general" ? side[field] : side.general);
  } else {
    lines.push(side.general);
    if (field !== "general") lines.push(`放到${topic.name}上：${side[field]}`);
  }
  return lines.join("\n");
}

// ── 對話 ──
const thread = () => $("#thread");
let session = null; // 目前這一輪占卜
let busy = false;

function scrollToEnd(node) {
  const rect = node.getBoundingClientRect();
  if (rect.bottom > window.innerHeight - 90 || rect.top < 60) node.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "end" });
}

function addRow(node, who = "bot") {
  const row = el("div", `msg ${who}`, [who === "bot" ? el("span", "avatar", "牌") : null, node]);
  thread().append(row);
  scrollToEnd(row);
  return row;
}

function userSay(text) {
  addRow(el("div", "bubble", text), "user");
}

// 讀牌者說話：先出現「…」，再逐字打出來
async function say(text, extra) {
  const bubble = el("div", "bubble");
  const row = addRow(bubble);
  if (!instant) {
    bubble.append(el("span", "typing", [el("i"), el("i"), el("i")]));
    await pause(Math.min(900, 380 + text.length * 3));
    bubble.replaceChildren();
    const p = el("p");
    bubble.append(p);
    const step = Math.max(2, Math.ceil(text.length / 60));
    for (let i = 0; i < text.length; i += step) {
      p.textContent = text.slice(0, i + step);
      if (i % (step * 6) === 0) scrollToEnd(row);
      await new Promise((r) => setTimeout(r, 16));
    }
  } else {
    bubble.append(el("p", null, text));
  }
  if (extra) bubble.append(extra);
  scrollToEnd(row);
  return bubble;
}

function chips(list) {
  const box = el("div", "chips", list.map(([label, action]) => {
    const b = el("button", "chip", label);
    b.type = "button";
    b.addEventListener("click", () => {
      if (busy) return;
      box.closest(".msg").remove();
      action(label);
    });
    return b;
  }));
  addRow(box, "bot widget suggest");
  return box;
}

function cardSlot(p, label) {
  const flip = el("div", "flip", [el("div", "face back card-back"), el("div", "face front", [cardImage(p)])]);
  const slot = el("button", "slot", [flip, el("span", "slot-pos", label), el("span", "slot-name", cardLabel(p))]);
  slot.type = "button";
  slot.addEventListener("click", () => { if (slot.classList.contains("open")) openCard(p); });
  return slot;
}

// ── 儀式：洗牌 → 切牌 → 抽牌 ──
function shuffleWidget() {
  const wheel = el("div", "wheel", Array.from({ length: 12 }, (_, i) => {
    const back = el("div", "card-back");
    back.style.setProperty("--i", i);
    return back;
  }));
  addRow(wheel, "bot widget");
  return wheel;
}

function cutWidget() {
  return new Promise((resolve) => {
    const piles = el("div", "piles", [0, 1, 2].map((i) => {
      const pile = el("button", "pile", [el("div", "card-back"), el("div", "card-back"), el("div", "card-back"), el("span", null, ["左", "中", "右"][i])]);
      pile.type = "button";
      pile.addEventListener("click", () => {
        piles.querySelectorAll(".pile").forEach((x) => { x.disabled = true; x.classList.toggle("chosen", x === pile); });
        resolve(i);
      });
      return pile;
    }));
    addRow(piles, "bot widget");
  });
}

function drawWidget(deck, need, labels) {
  return new Promise((resolve) => {
    const picked = [];
    const status = el("p", "draw-status", `憑直覺抽 ${need} 張（0／${need}）`);
    const slots = el("div", `slots n${need}`);
    const fan = el("div", "deck-fan");
    const allowReversed = $("#allow-reversed").checked;
    const take = (back, cardIndex) => {
      if (picked.length >= need || back.classList.contains("taken")) return;
      back.classList.add("taken");
      back.disabled = true;
      const p = { card: cardIndex, reversed: allowReversed && randomInt(2) === 1, deck: pickDeck() };
      picked.push(p);
      slots.append(cardSlot(p, labels[picked.length - 1]));
      status.textContent = `憑直覺抽 ${need} 張（${picked.length}／${need}）`;
      if (navigator.vibrate) navigator.vibrate(10);
      if (picked.length === need) {
        fan.classList.add("done");
        auto.remove();
        setTimeout(() => resolve({ picked, slots, fan }), instant ? 0 : 450);
      }
    };
    fan.append(...deck.map((cardIndex, i) => {
      const back = el("button", "card-back fan");
      back.type = "button";
      back.style.setProperty("--i", i);
      back.setAttribute("aria-label", `第 ${i + 1} 張牌`);
      back.addEventListener("click", () => take(back, cardIndex));
      return back;
    }));
    const auto = el("button", "link", "隨機幫我抽");
    auto.type = "button";
    auto.addEventListener("click", () => {
      const rest = [...fan.querySelectorAll(".card-back:not(.taken)")];
      while (picked.length < need && rest.length) rest.splice(randomInt(rest.length), 1)[0].click();
    });
    addRow(el("div", "draw-box", [status, fan, auto, slots]), "bot widget");
  });
}

async function reveal(slots) {
  for (const slot of slots.querySelectorAll(".slot")) {
    await pause(slots.children.length > 3 ? 220 : 420);
    slot.classList.add("open");
  }
  await pause(500);
}

// 抽一張追問用的牌：從剩下的牌裡攤開七張讓人挑
function drawOneWidget(session) {
  return new Promise((resolve) => {
    const used = new Set([...session.cards, ...session.followups.filter((f) => f.card).map((f) => f.card)].map((p) => p.card));
    const rest = session.deck.filter((c) => !used.has(c));
    const choices = rest.slice(0, 7);
    const box = el("div", "mini-fan", choices.map((cardIndex, i) => {
      const back = el("button", "card-back fan");
      back.type = "button";
      back.style.setProperty("--i", i);
      back.addEventListener("click", () => {
        box.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.toggle("taken", b !== back); });
        resolve({ card: cardIndex, reversed: $("#allow-reversed").checked && randomInt(2) === 1, deck: pickDeck() });
      });
      return back;
    }));
    addRow(box, "bot widget");
  });
}

// ── 一輪占卜 ──
async function startReading(question) {
  busy = true;
  const form = detectForm(question);
  const topic = detectTopic(question, "auto");
  const spread = chooseSpread(form, question);
  session = { question, topic: "auto", spread, options: undefined, cards: [], followups: [], reversals: $("#allow-reversed").checked, time: Date.now(), deck: [] };
  if (spread === "choice") {
    const parts = question.replace(/[？?。！!]/g, "").split(/還是|或是|或者/);
    session.options = parts.length >= 2
      ? [parts[0].replace(/^(我)?(現在)?(該|要|應該|是要)?(選)?/, "").trim().slice(0, 16) || "A", parts[1].trim().slice(0, 16) || "B"]
      : ["A", "B"];
  }
  userSay(question);
  const intro = [FORM_PHRASES[form.type], topic.key !== "general" ? `這是${topic.name}方面的事` : ""].filter(Boolean).join("，");
  const def = SPREADS[spread];
  const labels = def.positions.map((_, i) => positionName(session, i));
  await say(`${intro ? intro + "。" : "我聽到了。"}我用「${def.name}」來看，抽 ${labels.length} 張：${labels.join("、")}。\n洗牌的時候，在心裡把問題再想一次。`);
  busy = false;
  chips([["開始洗牌", () => ritual()], ["換一個牌陣", () => pickSpread()]]);
}

async function pickSpread() {
  await say("想用哪一種牌陣？");
  chips(SPREAD_ORDER.filter((k) => k !== session.spread).map((k) => [SPREADS[k].name, () => {
    session.spread = k;
    if (k === "choice" && !session.options) session.options = ["A", "B"];
    userSay(`用「${SPREADS[k].name}」`);
    ritual();
  }]));
}

async function ritual() {
  busy = true;
  const def = SPREADS[session.spread];
  const labels = def.positions.map((_, i) => positionName(session, i));
  const wheel = shuffleWidget();
  wheel.classList.add("spinning");
  await pause(1700);
  wheel.classList.remove("spinning");
  await say("切牌：憑感覺選一疊。");
  busy = false;
  const pile = await cutWidget();
  busy = true;
  // 切牌：把牌堆從選中的那一疊切開，下面的放到上面
  const deck = shuffled(TAROT.length);
  const cut = pile * 26 + randomInt(26);
  session.deck = [...deck.slice(cut), ...deck.slice(0, cut)];
  await pause(300);
  busy = false;
  const { picked, slots } = await drawWidget(session.deck, labels.length, labels);
  busy = true;
  session.cards = picked;
  session.time = Date.now();
  await reveal(slots);
  await narrate(session, slots);
  saveSession(session);
  busy = false;
  offerFollowups();
}

// 逐張說牌，再給結論與整體牌面
async function narrate(entry, slots) {
  const reading = tarotReading(entry);
  for (const c of reading.perCard) {
    await say(`「${c.position}」${cardLabel(c.p)}\n${c.keywords}\n${c.text}`);
  }
  const tone = el("span", `tone ${reading.tone.tier}`, reading.tone.label);
  const verdict = await say(reading.summary.join("\n"));
  verdict.classList.add("verdict");
  verdict.prepend(tone);
  if (reading.overall.length) await say(reading.overall.join("\n"));
  const poster = posterButton(() => tarotPoster(entry, reading, [...slots.querySelectorAll("img")]), `觀象-塔羅-${new Date(entry.time).toISOString().slice(0, 10)}.png`);
  poster.classList.add("chip");
  addRow(el("div", "chips", [poster]), "bot widget");
}

function offerFollowups() {
  const topic = detectTopic(session.question, session.topic).key;
  const done = new Set(session.followups.map((f) => f.type));
  const list = ["advice", topic === "love" && session.spread !== "mind" ? "mind" : null, "timing", session.spread === "one" ? "outcome" : null, "clarify"]
    .filter((t) => t && !done.has(t))
    .map((t) => [FOLLOWUPS[t].label, (label) => followup(t, label)]);
  list.push(["問新的問題", () => newConversation(true)]);
  chips(list);
}

async function followup(type, text) {
  busy = true;
  userSay(text);
  const def = FOLLOWUPS[type];
  let card = null;
  if (def.draw) {
    await say(`好，從剩下的牌裡再抽一張「${def.position}」。`);
    busy = false;
    card = await drawOneWidget(session);
    busy = true;
    const slots = el("div", "slots n1", [cardSlot(card, def.position)]);
    addRow(slots, "bot widget");
    await reveal(slots);
  }
  session.followups.push({ type, question: text, card });
  await say(followupText(session, type, card));
  saveSession(session);
  busy = false;
  offerFollowups();
}

async function newConversation(prompted) {
  session = null;
  if (!prompted) thread().replaceChildren();
  await say(prompted ? "好，想問什麼？" : "嗨，我是觀象。把你心裡的問題告訴我，一次問一件事，問得越具體，牌回答得越清楚。");
  if (!prompted) {
    chips([
      ["他對我是認真的嗎？", sendQuestion],
      ["我該不該換工作？", sendQuestion],
      ["我該留在現在的公司還是去新公司？", sendQuestion],
      ["這段感情該怎麼走下去？", sendQuestion],
      ["這個月的財運怎麼樣？", sendQuestion],
    ]);
  }
}

function clearSuggestions() {
  thread().querySelectorAll(".msg.suggest").forEach((row) => row.remove());
}

function sendQuestion(text) {
  const q = text.trim();
  if (!q || busy) return;
  // 已經讀過牌、問的是追問，就接著這一輪；否則開新的一輪
  if (session && session.cards.length) {
    // 先看「多久」再看「結果」：「多久會有結果」問的是時間
    const type = ["timing", "mind", "advice", "outcome", "clarify"].find((t) => FOLLOWUPS[t].pattern.test(q) && q.length <= 16);
    if (type) {
      clearSuggestions();
      return followup(type, q);
    }
  }
  clearSuggestions();
  startReading(q);
}

// ── 點牌看牌義 ──
function openCard(p) {
  const card = cardOf(p);
  const side = cardSide(p);
  const other = p.reversed ? card.up : card.rev;
  const body = $("#card-dialog-body");
  body.replaceChildren(
    el("div", "dialog-card", [cardImage(p)]),
    el("h3", null, `${card.name}${p.reversed ? "・逆位" : "・正位"}`),
    el("p", "meta", card.en),
    el("p", "tarot-keywords", side.keywords),
    el("p", null, side.general),
    el("dl", "card-facets", [
      el("dt", null, "感情"), el("dd", null, side.love),
      el("dt", null, "工作"), el("dd", null, side.work),
      el("dt", null, "金錢"), el("dd", null, side.money),
    ]),
    el("p", "hint", `${p.reversed ? "正位" : "逆位"}時：${other.keywords}`),
  );
  const dialog = $("#card-dialog");
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
}

// ── 今日塔羅 ──
function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let dailyOffset = 0;
function renderDaily() {
  const key = dayKey(dailyOffset);
  const daily = readJSON(TAROT_DAILY_KEY, {});
  const p = daily[key];
  const body = $("#daily-body");
  const when = dailyOffset ? "明天" : "今天";
  if (!p || !TAROT[p.card]) {
    const back = el("button", "card-back daily-back");
    back.type = "button";
    back.setAttribute("aria-label", `抽${when}的牌`);
    back.addEventListener("click", async () => {
      back.classList.add("lifting");
      await pause(450);
      const next = readJSON(TAROT_DAILY_KEY, {});
      next[key] = { card: randomInt(TAROT.length), reversed: $("#allow-reversed").checked && randomInt(2) === 1, deck: pickDeck() };
      writeJSON(TAROT_DAILY_KEY, next);
      renderDaily();
      renderCalendar();
    });
    body.replaceChildren(el("div", "daily-empty", [back, el("p", null, `點一下牌，抽${when}的牌。${dailyOffset ? "明天的牌可以先抽，看看明天的能量。" : "一天一張，抽了就不能重抽。"}`)]));
    return;
  }
  const side = cardSide(p);
  const level = cardLevel(p);
  const tip = level >= 4 ? `${when}的能量是順的，適合主動。` : level === 3 ? `${when}平穩，照步調走就好。` : `${when}要放慢一點，留意牌提醒的事。`;
  const img = cardImage(p);
  const imgButton = el("button", "daily-card", [img]);
  imgButton.type = "button";
  imgButton.addEventListener("click", () => openCard(p));
  body.replaceChildren(el("div", "daily-result", [
    imgButton,
    el("div", null, [
      el("h3", null, cardLabel(p)),
      el("p", "tarot-keywords", side.keywords),
      el("p", null, `${tip}${side.general}`),
      el("p", "daily-facet", `感情：${side.love}`),
      el("p", "daily-facet", `工作：${side.work}`),
      el("p", "daily-facet", `金錢：${side.money}`),
    ]),
  ]));
}

// ── 牌背 ──
const BACKS = [["wine", "酒紅"], ["night", "星夜"], ["jade", "墨綠"], ["ivory", "象牙"]];
function applyBack(key) {
  document.documentElement.dataset.back = key;
  try { localStorage.setItem(TAROT_BACK_KEY, key); } catch { /* 忽略 */ }
  $("#backs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.back === key));
}

// ── 紀錄 ──
function loadSessions() {
  const list = readJSON(TAROT_HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((e) => e && SPREADS[e.spread] && Array.isArray(e.cards)
    && e.cards.length === SPREADS[e.spread].positions.length && e.cards.every((p) => TAROT[p.card])
    && Array.isArray(e.followups ?? [])) : [];
}

function saveSession(s) {
  const record = { ...s, deck: s.deck, followups: s.followups || [] };
  const list = loadSessions().filter((e) => e.time !== s.time && e.id !== s.id);
  record.id = s.id || s.time;
  s.id = record.id;
  writeJSON(TAROT_HISTORY_KEY, [record, ...list].slice(0, TAROT_HISTORY_LIMIT));
  renderCalendar();
}

// 重看一筆紀錄：把整段對話重新畫出來，不播動畫
async function replay(entry) {
  if (busy) return;
  busy = true;
  instant = true;
  thread().replaceChildren();
  session = { ...entry, followups: [...(entry.followups || [])], deck: entry.deck || shuffled(TAROT.length) };
  userSay(entry.question || "（沒有寫問題）");
  await say(`${new Date(entry.time).toLocaleString("zh-TW")}，用「${SPREADS[entry.spread].name}」抽的牌。`);
  const slots = el("div", `slots n${entry.cards.length}`, entry.cards.map((p, i) => cardSlot(p, positionName(entry, i))));
  slots.querySelectorAll(".slot").forEach((s) => s.classList.add("open"));
  addRow(el("div", "draw-box", [slots]), "bot widget");
  await narrate(entry, slots);
  for (const f of session.followups) {
    userSay(f.question);
    if (f.card) {
      const s = el("div", "slots n1", [cardSlot(f.card, FOLLOWUPS[f.type].position)]);
      s.firstChild.classList.add("open");
      addRow(s, "bot widget");
    }
    await say(followupText({ ...session, followups: session.followups.slice(0, session.followups.indexOf(f) + 1) }, f.type, f.card));
  }
  instant = TAROT_CALM;
  busy = false;
  offerFollowups();
  $("#chat").scrollIntoView({ behavior: "smooth", block: "start" });
}

let calendarMonth = new Date();
calendarMonth.setDate(1);
let selectedDay = dayKey(0);

function renderCalendar() {
  const sessions = loadSessions();
  const daily = readJSON(TAROT_DAILY_KEY, {});
  const byDay = {};
  for (const s of sessions) {
    const d = new Date(s.time);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (byDay[k] = byDay[k] || []).push(s);
  }
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
  $("#cal-title").textContent = `${y} 年 ${m + 1} 月`;
  const cells = ["日", "一", "二", "三", "四", "五", "六"].map((w) => el("span", "cal-week", w));
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) cells.push(el("span"));
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cell = el("button", `cal-day${k === dayKey(0) ? " today" : ""}${k === selectedDay ? " selected" : ""}`, [
      el("span", null, String(d)),
      el("span", "cal-dots", [byDay[k] ? el("i", "dot-reading") : null, daily[k] ? el("i", "dot-daily") : null]),
    ]);
    cell.type = "button";
    cell.addEventListener("click", () => { selectedDay = k; renderCalendar(); });
    cells.push(cell);
  }
  $("#calendar").replaceChildren(...cells);

  // 選中那一天的紀錄
  const items = [];
  const dp = daily[selectedDay];
  if (dp && TAROT[dp.card]) {
    const b = el("button", "history-item", [el("span", "history-hex", "今日塔羅"), el("span", "history-q", cardLabel(dp)), el("span", "history-time", selectedDay.slice(5).replace("-", "/"))]);
    b.type = "button";
    b.addEventListener("click", () => openCard(dp));
    items.push(el("li", null, [b]));
  }
  for (const s of byDay[selectedDay] || []) {
    const b = el("button", "history-item", [
      el("span", "history-hex", s.question || "（沒有寫問題）"),
      el("span", "history-q", s.cards.map(cardLabel).join("、")),
      el("span", "history-time", `${SPREADS[s.spread].name} · ${new Date(s.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`),
    ]);
    b.type = "button";
    b.addEventListener("click", () => replay(s));
    items.push(el("li", null, [b]));
  }
  if (!items.length) items.push(el("li", "hint", sessions.length ? "這一天沒有紀錄。" : "還沒有紀錄。抽過的牌和今日塔羅都會記在月曆上。"));
  $("#history").replaceChildren(...items);
}

// ── 存成圖片 ──
function tarotPoster(entry, reading, imgs) {
  const { canvas, ctx, colors } = createPoster("tarot", `塔羅 · ${SPREADS[entry.spread].name} · ${new Date(entry.time).toLocaleDateString("zh-TW")}`);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 46px ${POSTER_SERIF}`;
  let y = posterWrap(ctx, entry.question ? `問：${entry.question}` : "塔羅", 540, 200, 900, 62, 2);
  const n = entry.cards.length;
  const perRow = n > 5 ? 5 : n;
  const rows = Math.ceil(n / perRow);
  const w = n === 1 ? 260 : n <= 3 ? 220 : 150;
  const h = Math.round(w * 1.72);
  const gap = 24;
  const top = y + 40;
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
    ctx.fillText(cardOf(p).name + (p.reversed ? "（逆）" : ""), x + w / 2, cy + h + 32);
  });
  y = top + rows * (h + 70) + 40;
  ctx.textAlign = "center";
  ctx.fillStyle = colors.accent;
  ctx.font = `700 42px ${POSTER_SERIF}`;
  ctx.fillText(`【${reading.tone.label}】`, 540, y);
  ctx.fillStyle = colors.ink;
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.textAlign = "left";
  posterWrap(ctx, reading.summary[0], 110, y + 60, 860, 46, Math.max(2, Math.floor((1230 - y - 60) / 46)));
  return canvas;
}

// ── 初始化 ──
$("#composer").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#ask-input");
  if (busy) return;
  sendQuestion(input.value);
  input.value = "";
});
$("#btn-new").addEventListener("click", () => { if (!busy) newConversation(false); });
$("#btn-settings").addEventListener("click", () => { $("#settings").hidden = !$("#settings").hidden; });
$("#backs").append(...BACKS.map(([key, label]) => {
  const b = el("button", null, [el("span", `back-swatch card-back back-${key}`), label]);
  b.type = "button";
  b.dataset.back = key;
  b.addEventListener("click", () => applyBack(key));
  return b;
}));
$("#decks").append(...DECKS.map(([key, label]) => {
  const b = el("button", key === deckChoice ? "active" : "", label);
  b.type = "button";
  b.addEventListener("click", () => {
    deckChoice = key;
    try { localStorage.setItem("tarot-deck", key); } catch { /* 忽略 */ }
    $("#decks").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  });
  return b;
}));
applyBack((() => { try { return localStorage.getItem(TAROT_BACK_KEY) || "wine"; } catch { return "wine"; } })());
document.querySelectorAll(".daily-tabs button").forEach((b) => b.addEventListener("click", () => {
  dailyOffset = Number(b.dataset.day);
  document.querySelectorAll(".daily-tabs button").forEach((x) => x.classList.toggle("active", x === b));
  renderDaily();
}));
$("#cal-prev").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
$("#cal-next").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });
$("#btn-clear").addEventListener("click", () => {
  if (!confirm("確定要清除所有塔羅紀錄（包含今日塔羅）嗎？")) return;
  try { localStorage.removeItem(TAROT_HISTORY_KEY); localStorage.removeItem(TAROT_DAILY_KEY); } catch { /* 忽略 */ }
  renderCalendar();
  renderDaily();
});
$("#card-dialog").addEventListener("click", (event) => { if (event.target.id === "card-dialog") event.target.close(); });
renderDaily();
renderCalendar();
newConversation(false);
