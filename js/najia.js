// 六爻納甲（文王卦）：干支曆、八宮世應、納甲、六親、六神，以及用神的基本判讀。
// 規則依通行的《納甲歌》（見《增刪卜易》等）：
//   乾金甲子外壬午，坎水戊寅外戊申，艮土丙辰外丙戌，震木庚子外庚午，
//   巽木辛丑外辛未，離火己卯外己酉，坤土乙未外癸丑，兌金丁巳外丁亥。
// 六神依日干：甲乙起青龍，丙丁起朱雀，戊起勾陳，己起螣蛇，庚辛起白虎，壬癸起玄武，由初爻往上排。

// 每卦：[內卦天干, 外卦天干, 內卦三爻地支, 外卦三爻地支]（皆由下往上）
const NAJIA = {
  乾: ["甲", "壬", "子寅辰", "午申戌"],
  坤: ["乙", "癸", "未巳卯", "丑亥酉"],
  震: ["庚", "庚", "子寅辰", "午申戌"],
  巽: ["辛", "辛", "丑亥酉", "未巳卯"],
  坎: ["戊", "戊", "寅辰午", "申戌子"],
  離: ["己", "己", "卯丑亥", "酉未巳"],
  艮: ["丙", "丙", "辰午申", "戌子寅"],
  兌: ["丁", "丁", "巳卯丑", "亥酉未"],
};
const BRANCH_ELEMENTS = "水土木木土火火土金金土水"; // 子丑寅卯辰巳午未申酉戌亥
const GENERATES = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const SPIRITS = ["青龍", "朱雀", "勾陳", "螣蛇", "白虎", "玄武"];
const SPIRIT_START = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5]; // 依日干 甲乙丙丁戊己庚辛壬癸
const GENERATION_NAMES = ["八純", "一世", "二世", "三世", "四世", "五世", "游魂", "歸魂"];

const elementOfBranch = (branch) => BRANCH_ELEMENTS[BRANCHES.indexOf(branch)];
const controls = (a, b) => GENERATES[GENERATES[a]] === b; // a 剋 b

// 六親：以本宮五行為「我」
function relativeOf(palaceElement, element) {
  if (element === palaceElement) return "兄弟";
  if (GENERATES[palaceElement] === element) return "子孫";
  if (GENERATES[element] === palaceElement) return "父母";
  if (controls(palaceElement, element)) return "妻財";
  return "官鬼";
}

// ── 八宮 ── 由八純卦依序變初爻到五爻得一世到五世；五世卦四爻變回為游魂；游魂內卦全變回為歸魂。
// 世爻位置（0 為初爻）：八純在上爻，一世到五世在初爻到五爻，游魂在四爻，歸魂在三爻。
const PALACES = {};
(() => {
  const flipSets = [[], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 4], [4]];
  const worlds = [5, 0, 1, 2, 3, 4, 3, 2];
  for (const [name, trigram] of Object.entries(TRIGRAMS)) {
    const pure = [...trigram.lines, ...trigram.lines];
    flipSets.forEach((flips, generation) => {
      const bits = pure.map((bit, i) => (flips.includes(i) ? 1 - bit : bit));
      PALACES[bits.join("")] = { palace: name, generation, world: worlds[generation] };
    });
  }
})();

// 一個卦六爻的干支（由下往上）
function najiaLines(hex) {
  const [innerStem, , innerBranches] = NAJIA[hex.lower];
  const [, outerStem, , outerBranches] = NAJIA[hex.upper];
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const stem = i < 3 ? innerStem : outerStem;
    const branch = i < 3 ? innerBranches[i] : outerBranches[i - 3];
    return { stem, branch, element: elementOfBranch(branch) };
  });
}

// ── 干支曆 ──
// 太陽黃經（度），用來定節氣；精度約 0.01 度，節氣交接時刻誤差在半小時內。instant 是毫秒時間戳。
function solarLongitudeAt(instant) {
  const days = instant / 86400000 + 2440587.5 - 2451545.0;
  const rad = Math.PI / 180;
  const mean = 280.46 + 0.9856474 * days;
  const anomaly = (357.528 + 0.9856003 * days) * rad;
  const longitude = mean + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly);
  return ((longitude % 360) + 360) % 360;
}

// 找出最近的「節」（立春、驚蟄…每 30 度一個，交節才換月）的時刻。forward 為 true 找下一個，否則找上一個。
function nearestJie(instant, forward) {
  const longitude = solarLongitudeAt(instant);
  const offset = ((longitude - 15) % 30 + 30) % 30; // 距離上一個節過了幾度
  let target = instant + ((forward ? 30 - offset : -offset) / 0.9856474) * 86400000;
  for (let i = 0; i < 6; i++) {
    const boundary = Math.round((solarLongitudeAt(target) - 15) / 30) * 30 + 15;
    const diff = ((solarLongitudeAt(target) - boundary + 540) % 360) - 180;
    target -= (diff / 0.9856474) * 86400000;
  }
  return target;
}

// 由「當地鐘面時間」（年月日時）與絕對時刻算四柱。年以立春為界、月以節氣為界（不是農曆初一）。
// lateZi：晚上 11 點後日柱算隔天（八字的慣例）。
function ganzhiAt(y, m, d, hour, instant, lateZi = false) {
  const pair = (index) => STEMS[index % 10] + BRANCHES[index % 12];
  const longitude = solarLongitudeAt(instant);

  // 月支：立春（黃經 315 度）起寅月，每 30 度一個月
  const monthBranch = (Math.floor(((longitude + 45) % 360) / 30) + 2) % 12;

  // 年：一、二月且還沒到立春，算前一年
  const year = m <= 2 && longitude >= 270 && longitude < 315 ? y - 1 : y;
  const yearIndex = (((year - 4) % 60) + 60) % 60;

  // 月干：甲己之年丙作首（寅月起丙），依序往下
  const monthStem = ((yearIndex % 5) * 2 + 2 + ((monthBranch - 2 + 12) % 12)) % 10;

  // 日：儒略日推算（2000-01-01 為戊午日）
  const a = Math.floor((14 - m) / 12);
  const jdn = d + Math.floor((153 * (m + 12 * a - 3) + 2) / 5) + 365 * (y + 4800 - a)
    + Math.floor((y + 4800 - a) / 4) - Math.floor((y + 4800 - a) / 100) + Math.floor((y + 4800 - a) / 400) - 32045;
  const dayIndex = (jdn + 49 + (lateZi && hour >= 23 ? 1 : 0)) % 60;

  // 時：甲己日起甲子時
  const hourBranch = Math.floor(((hour + 1) % 24) / 2);
  const hourStem = ((dayIndex % 5) * 2 + hourBranch) % 10;

  // 旬空：日柱所在的一旬用不到的兩個地支
  const xunStart = dayIndex - (dayIndex % 10);
  const empty = [BRANCHES[(xunStart + 10) % 12], BRANCHES[(xunStart + 11) % 12]];

  return {
    year: pair(yearIndex),
    month: STEMS[monthStem] + BRANCHES[monthBranch],
    day: pair(dayIndex),
    hour: STEMS[hourStem] + BRANCHES[hourBranch],
    monthBranch: BRANCHES[monthBranch],
    dayStem: dayIndex % 10,
    dayBranch: BRANCHES[dayIndex % 12],
    yearIndex, monthIndex: [monthStem, monthBranch], dayIndex, hourIndex: [hourStem, hourBranch],
    empty,
  };
}

// 以這台裝置的當地時間算四柱（卜卦用）
function ganzhiDate(date) {
  return ganzhiAt(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getTime());
}
// ── 裝卦 ──
function najiaChart(result, date) {
  const { primary, changed, moving } = result;
  const info = PALACES[primary.bits.join("")];
  const palaceElement = TRIGRAMS[info.palace].element;
  const calendar = ganzhiDate(date);
  const changedLines = changed ? najiaLines(changed) : null;

  const lines = najiaLines(primary).map((line, i) => {
    const row = {
      ...line,
      index: i,
      relative: relativeOf(palaceElement, line.element),
      spirit: SPIRITS[(SPIRIT_START[calendar.dayStem] + i) % 6],
      world: i === info.world,
      response: i === (info.world + 3) % 6,
      moving: moving.includes(i),
      empty: calendar.empty.includes(line.branch),
    };
    if (row.moving) {
      const to = changedLines[i];
      row.change = { ...to, relative: relativeOf(palaceElement, to.element) };
    }
    return row;
  });

  // 伏神：卦中缺的六親，藏在本宮八純卦同一爻位之下
  const present = new Set(lines.map((line) => line.relative));
  const pureTrigram = TRIGRAMS[info.palace];
  const pureLines = najiaLines({ lower: info.palace, upper: info.palace, bits: [...pureTrigram.lines, ...pureTrigram.lines] });
  const hidden = [];
  pureLines.forEach((line, i) => {
    const relative = relativeOf(palaceElement, line.element);
    if (!present.has(relative) && !hidden.some((h) => h.relative === relative)) {
      hidden.push({ ...line, relative, index: i });
    }
  });

  return { ...info, palaceElement, generationName: GENERATION_NAMES[info.generation], calendar, lines, hidden };
}

// ── 用神判讀 ──
// 各類問題取哪個六親為用神（null 表示看世爻）
const USE_GOD = {
  career: ["官鬼"], money: ["妻財"], study: ["父母"],
  love: ["妻財", "官鬼"], health: null, travel: null, general: null,
};
const USE_GOD_NOTE = {
  career: "問事業、工作、功名，以官鬼爻為用神。",
  money: "問財運、買賣、投資，以妻財爻為用神。",
  study: "問學業、考試、文書，以父母爻為用神。",
  love: "問感情，男占以妻財爻為用神，女占以官鬼爻為用神，兩者都列出，請看屬於你的那一個。",
  health: "問自己的健康，以世爻為主（世爻代表自己）；官鬼爻代表病症。",
  travel: "問出行，以世爻為主（世爻代表自己）。",
  general: "沒有指定問題類別時，以世爻為主（世爻代表自己）。",
};

// 月建或日辰對一個爻的作用
function influence(sourceBranch, line) {
  const source = elementOfBranch(sourceBranch);
  if (sourceBranch === line.branch) return { score: 2, text: "臨" };
  if (source === line.element) return { score: 1, text: "扶" };
  if (GENERATES[source] === line.element) return { score: 1, text: "生" };
  if (controls(source, line.element)) return { score: -1, text: "剋" };
  return { score: 0, text: "" };
}

// 評估一個爻的強弱，回傳 { score, notes }
function assessLine(line, calendar, label) {
  const position = `${POSITION_NAMES[line.index]}爻${line.stem}${line.branch}${line.element}`;
  const notes = [];
  let score = 0;

  const month = influence(calendar.monthBranch, line);
  const day = influence(calendar.dayBranch, line);
  score += month.score + day.score;
  notes.push(month.text
    ? `月建${calendar.monthBranch}${month.text}之${month.score > 0 ? "，得令有力" : "，失令受制"}`
    : `月建${calendar.monthBranch}對它無生無剋，休囚而氣弱`);
  if (day.text) notes.push(`日辰${calendar.dayBranch}${day.text}之${day.score > 0 ? "，有日辰幫扶" : "，被日辰所傷"}`);

  const clash = (BRANCHES.indexOf(calendar.dayBranch) + 6) % 12 === BRANCHES.indexOf(line.branch);
  if (clash && !line.moving) {
    if (score > 0) notes.push("靜爻逢日辰相沖而旺，是暗動，事情暗中在進行");
    else { score -= 1; notes.push("靜爻逢日辰相沖而衰，是日破，力量被沖散"); }
  }
  if (line.empty) { score -= 1; notes.push(`落在旬空（${calendar.empty.join("、")}空），眼前虛而不實，要等出空之後才算數`); }

  if (line.moving && line.change) {
    const to = line.change;
    if (GENERATES[to.element] === line.element) { score += 1; notes.push(`發動化出${to.branch}${to.element}，回頭生，越變越有力`); }
    else if (controls(to.element, line.element)) { score -= 2; notes.push(`發動化出${to.branch}${to.element}，回頭剋，自己壞了自己的事`); }
    else notes.push(`發動化出${to.relative}${to.branch}${to.element}，事情正在變動`);
  }
  return { score, text: `${label}在${position}：${notes.join("；")}。` };
}

// 回傳 { note, paragraphs, score }；score 為 null 表示無法判斷
function najiaReading(chart, topicKey) {
  const { lines, calendar, hidden } = chart;
  const wanted = USE_GOD[topicKey];
  const paragraphs = [];
  const scores = [];
  const targets = [];

  if (!wanted) {
    targets.push({ label: "世爻", line: lines.find((line) => line.world) });
  } else {
    for (const relative of wanted) {
      const found = lines.filter((line) => line.relative === relative);
      // 同一六親出現兩次時，取發動的；都不動就取持世的或第一個
      const pick = found.find((line) => line.moving) || found.find((line) => line.world) || found[0];
      if (pick) targets.push({ label: `用神${relative}`, line: pick });
      else {
        const under = hidden.find((h) => h.relative === relative);
        paragraphs.push(`用神${relative}不上卦，伏在${POSITION_NAMES[under.index]}爻之下（${under.stem}${under.branch}${under.element}）。`
          + "用神不現，表示你要的東西目前還沒有出現在局面上，時機未到。");
        scores.push(-1);
      }
    }
  }

  for (const { label, line } of targets) {
    const assessed = assessLine(line, calendar, label);
    let text = assessed.text;
    let score = assessed.score;

    // 原神（生用神者）與忌神（剋用神者）發動
    for (const other of lines.filter((l) => l.moving && l !== line)) {
      if (GENERATES[other.element] === line.element) { score += 1; text += `${POSITION_NAMES[other.index]}爻${other.relative}${other.branch}${other.element}發動來生，是原神相助。`; }
      else if (controls(other.element, line.element)) { score -= 1; text += `${POSITION_NAMES[other.index]}爻${other.relative}${other.branch}${other.element}發動來剋，是忌神為害。`; }
    }
    if (label !== "世爻" && line.world) text += "用神持世，這件事與你切身相關，主動權在你。";
    paragraphs.push(text);
    scores.push(score);
  }

  // 世應關係
  const world = lines.find((line) => line.world);
  const response = lines.find((line) => line.response);
  let relation;
  if (world.element === response.element) relation = "世應比和，雙方立場相近";
  else if (GENERATES[response.element] === world.element) relation = "應生世，對方或環境對你有利";
  else if (GENERATES[world.element] === response.element) relation = "世生應，是你在遷就、付出";
  else if (controls(world.element, response.element)) relation = "世剋應，你壓得住對方或局面";
  else relation = "應剋世，對方或環境壓著你";
  paragraphs.push(`世爻（自己）在${POSITION_NAMES[world.index]}爻${world.relative}${world.branch}${world.element}，`
    + `應爻（對方、所求之事）在${POSITION_NAMES[response.index]}爻${response.relative}${response.branch}${response.element}：${relation}。`);

  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  let verdict;
  if (score === null) verdict = "";
  else if (score >= 2) verdict = "納甲來看，用神旺相有力，這件事成得了。";
  else if (score >= 1) verdict = "納甲來看，用神有氣，事情可成，但不是毫不費力。";
  else if (score > -1) verdict = "納甲來看，用神不旺不衰，成敗各半，要看後續的變化。";
  else if (score > -2) verdict = "納甲來看，用神無力，這件事難成，勉強去做也撐不久。";
  else verdict = "納甲來看，用神受剋又無援，這件事不成。";

  return { note: USE_GOD_NOTE[topicKey], paragraphs, verdict, score };
}

// 讓 Node 也能載入做測試；在瀏覽器裡這段不會執行
if (typeof module !== "undefined") {
  module.exports = { PALACES, najiaLines, ganzhiAt, ganzhiDate, nearestJie, najiaChart, najiaReading, solarLongitudeAt };
}
