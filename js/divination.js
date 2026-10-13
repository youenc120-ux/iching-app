// 起卦邏輯（不碰畫面）。爻一律「由下往上」排列：索引 0 是初爻，5 是上爻。
// 爻值：6 老陰（變）、7 少陽、8 少陰、9 老陽（變）

// 八卦：lines 為 [初, 中, 上]，1 = 陽、0 = 陰；num 為先天八卦數
const TRIGRAMS = {
  乾: { lines: [1, 1, 1], symbol: "☰", nature: "天", element: "金", num: 1 },
  兌: { lines: [1, 1, 0], symbol: "☱", nature: "澤", element: "金", num: 2 },
  離: { lines: [1, 0, 1], symbol: "☲", nature: "火", element: "火", num: 3 },
  震: { lines: [1, 0, 0], symbol: "☳", nature: "雷", element: "木", num: 4 },
  巽: { lines: [0, 1, 1], symbol: "☴", nature: "風", element: "木", num: 5 },
  坎: { lines: [0, 1, 0], symbol: "☵", nature: "水", element: "水", num: 6 },
  艮: { lines: [0, 0, 1], symbol: "☶", nature: "山", element: "土", num: 7 },
  坤: { lines: [0, 0, 0], symbol: "☷", nature: "地", element: "土", num: 8 },
};
const TRIGRAM_BY_NUM = ["乾", "兌", "離", "震", "巽", "坎", "艮", "坤"];
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const POSITION_NAMES = ["初", "二", "三", "四", "五", "上"];

// 把 RAW 整理成好用的物件，並建立「六爻 → 卦」的查表
const HEXAGRAMS = RAW.map((row, i) => {
  const [name, upper, lower, judgment, judgmentPlain, image, lines, extra] = row;
  const bits = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
  const fullName = upper === lower
    ? `${name}為${TRIGRAMS[upper].nature}`
    : `${TRIGRAMS[upper].nature}${TRIGRAMS[lower].nature}${name}`;
  return {
    number: i + 1, name, fullName, upper, lower, bits,
    symbol: String.fromCodePoint(0x4dc0 + i),
    judgment, judgmentPlain, image,
    lines: lines.map(([text, plain]) => ({ text, plain })),
    extra: extra ? { text: extra[0], plain: extra[1] } : null,
  };
});
const HEX_BY_BITS = Object.fromEntries(HEXAGRAMS.map((h) => [h.bits.join(""), h]));

const isYang = (v) => v === 7 || v === 9;
const isMoving = (v) => v === 6 || v === 9;
const hexFromBits = (bits) => HEX_BY_BITS[bits.join("")];

// 爻題：初九、六二 … 上六
function lineTitle(index, yang) {
  const yao = yang ? "九" : "六";
  return index === 0 || index === 5 ? POSITION_NAMES[index] + yao : yao + POSITION_NAMES[index];
}

// ── 金錢卦 ── 三枚銅錢：正面記 3、反面記 2，相加得 6/7/8/9
function castCoinLine() {
  const coins = [0, 1, 2].map(() => (Math.random() < 0.5 ? 3 : 2));
  const value = coins.reduce((a, b) => a + b, 0);
  const detail = coins.map((c) => (c === 3 ? "正" : "反")).join(" ");
  return { value, detail, coins };
}

// ── 蓍草法 ── 大衍之數五十，其用四十有九；三變成一爻，十八變成一卦
function castYarrowLine() {
  let stalks = 49;
  const removed = [];
  for (let change = 0; change < 3; change++) {
    // 分二：信手分成左右兩堆（用逐根擲幣模擬，集中在中間），兩堆都不能空
    let left = 0;
    for (let i = 0; i < stalks; i++) if (Math.random() < 0.5) left++;
    left = Math.min(Math.max(left, 1), stalks - 2);
    const right = stalks - left - 1; // 掛一：從右堆取一根
    // 揲四、歸奇：每堆四根四根地數，餘數（整除則餘 4）取出
    const remL = left % 4 || 4;
    const remR = right % 4 || 4;
    const take = 1 + remL + remR;
    removed.push(take);
    stalks -= take;
  }
  return { value: stalks / 4, detail: `三變去 ${removed.join("、")} 策，餘 ${stalks} 策`, removed };
}

// ── 梅花易數 ──
// ── 農曆換算 ──
// 靠瀏覽器內建的農曆曆法（Intl），但各家瀏覽器回傳的格式不一樣：
// Chrome 給阿拉伯數字和對應的西元年；Safari 可能給「臘月」「廿四」這類中文，也可能不給年份。
// 所以月、日兩種寫法都認，年份則不依賴瀏覽器，改由月份自己推算。

// 中文數字轉數值：初一、十五、二十、廿四、三十、卅 …
function chineseNumber(text) {
  const digits = "〇一二三四五六七八九";
  let total = 0;
  let current = 0;
  for (const char of text) {
    if (char === "十") { total += (current || 1) * 10; current = 0; }
    else if (char === "廿") { total += 20; current = 0; }
    else if (char === "卅") { total += 30; current = 0; }
    else if (digits.includes(char)) current = digits.indexOf(char);
  }
  return total + current;
}

// 從瀏覽器回傳的文字讀出月或日的數值
function lunarNumber(text) {
  const digits = text.match(/\d+/);
  if (digits) return Number(digits[0]);
  return chineseNumber(text.replace("正", "一").replace("冬", "十一").replace("臘", "十二").replace("腊", "十二"));
}

// 把瀏覽器回傳的片段整理成 { month, day, leap }；讀不出來回傳 null
function parseLunarParts(parts) {
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  const monthText = get("month");
  const month = lunarNumber(monthText);
  const day = lunarNumber(get("day"));
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 30)) return null;
  return { month, day, leap: /閏|闰|bis|leap/i.test(monthText) };
}

// 西曆年月日換農曆。回傳 { year: 農曆年對應的西元年, month, day, leap }
function lunarOf(y, m, d) {
  const instant = new Date(Date.UTC(y, m - 1, d, 12));
  let lunar = null;
  for (const locale of ["en-US-u-ca-chinese-nu-latn", "zh-TW-u-ca-chinese-nu-latn", "zh-TW-u-ca-chinese"]) {
    try {
      const format = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" });
      if (!format.resolvedOptions().calendar.includes("chinese")) continue;
      lunar = parseLunarParts(format.formatToParts(instant));
    } catch {
      lunar = null;
    }
    if (lunar) break;
  }
  if (!lunar) throw new Error("這個瀏覽器無法換算農曆，請更新瀏覽器後再試。");
  // 國曆一、二月遇到農曆十一、十二月，表示還沒過年，農曆年是前一年
  lunar.year = m <= 2 && lunar.month >= 11 ? y - 1 : y;
  return lunar;
}

// 以這台裝置當地的日期換農曆，並附上年支數與干支年名（梅花易數用）
function lunarDate(date) {
  const lunar = lunarOf(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const offset = (((lunar.year - 4) % 60) + 60) % 60;
  return { branch: (offset % 12) + 1, month: lunar.month, day: lunar.day, yearName: STEMS[offset % 10] + BRANCHES[offset % 12] };
}
// 時辰數：子時（23–1 點）為 1 … 亥時為 12
const hourBranch = (date) => Math.floor(((date.getHours() + 1) % 24) / 2) + 1;

// 由上卦數、下卦數、動爻數（1–6）組出六爻值
function meihuaLines(upperNum, lowerNum, movingNum) {
  const upper = TRIGRAM_BY_NUM[(upperNum % 8 || 8) - 1];
  const lower = TRIGRAM_BY_NUM[(lowerNum % 8 || 8) - 1];
  const moving = (movingNum % 6 || 6) - 1;
  const bits = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
  return bits.map((b, i) => (i === moving ? (b ? 9 : 6) : b ? 7 : 8));
}

// 年月日時起卦：(年支+月+日) 取上卦，再加時辰取下卦與動爻
function castMeihuaByTime(date = new Date()) {
  const { branch, month, day, yearName } = lunarDate(date);
  const hour = hourBranch(date);
  const sum = branch + month + day;
  return {
    values: meihuaLines(sum, sum + hour, sum + hour),
    note: `農曆${yearName}年 ${month} 月 ${day} 日 ${BRANCHES[hour - 1]}時：`
      + `年支 ${branch} + 月 ${month} + 日 ${day} = ${sum}，除 8 取上卦；`
      + `再加時辰 ${hour} = ${sum + hour}，除 8 取下卦、除 6 取動爻。`,
  };
}

// 報數起卦：第一個數取上卦，第二個數取下卦，兩數加時辰取動爻
function castMeihuaByNumbers(a, b, date = new Date()) {
  const hour = hourBranch(date);
  return {
    values: meihuaLines(a, b, a + b + hour),
    note: `${a} 除 8 取上卦，${b} 除 8 取下卦；`
      + `${a} + ${b} + ${BRANCHES[hour - 1]}時 ${hour} = ${a + b + hour}，除 6 取動爻。`,
  };
}

// ── 解讀 ──
// 由六個爻值算出本卦、變卦（之卦）、互卦與動爻位置
function interpret(values) {
  const bits = values.map((v) => (isYang(v) ? 1 : 0));
  const moving = values.map((v, i) => (isMoving(v) ? i : -1)).filter((i) => i >= 0);
  const changedBits = values.map((v, i) => (isMoving(v) ? 1 - bits[i] : bits[i]));
  return {
    values, bits, moving,
    primary: hexFromBits(bits),
    changed: moving.length ? hexFromBits(changedBits) : null,
    // 互卦：二三四爻為下卦，三四五爻為上卦
    mutual: hexFromBits([bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]]),
  };
}

// 朱熹《易學啟蒙》的占斷原則：依動爻數量決定看哪一段辭
// 回傳 { tip, focus }，focus 是要標示重點的項目：
//   { hex: "primary" | "changed", part: "judgment" | "extra" | 爻索引, main: 是否為主 }
function readingGuide(result) {
  const { moving, primary } = result;
  const still = [0, 1, 2, 3, 4, 5].filter((i) => !moving.includes(i));
  const title = (hexKey, i) => lineTitle(i, result[hexKey].bits[i] === 1);
  switch (moving.length) {
    case 0:
      return { tip: "六爻皆靜，以本卦卦辭為主。", focus: [{ hex: "primary", part: "judgment", main: true }] };
    case 1:
      return {
        tip: `一爻動，以本卦「${title("primary", moving[0])}」爻辭為主。`,
        focus: [{ hex: "primary", part: moving[0], main: true }],
      };
    case 2:
      return {
        tip: `兩爻動，看本卦這兩爻的爻辭，以上面的「${title("primary", moving[1])}」為主。`,
        focus: [{ hex: "primary", part: moving[0] }, { hex: "primary", part: moving[1], main: true }],
      };
    case 3: {
      // 《易學啟蒙》：前十卦主貞（本卦），後十卦主悔（之卦）。動爻含初爻者屬前十卦。
      const front = moving.includes(0);
      return {
        tip: `三爻動，合看本卦與變卦的卦辭；${front ? "動爻含初爻，以本卦為主、變卦為輔" : "動爻不含初爻，以變卦為主、本卦為輔"}。`,
        focus: [{ hex: "primary", part: "judgment", main: front }, { hex: "changed", part: "judgment", main: !front }],
      };
    }
    case 4:
      return {
        tip: `四爻動，看變卦中兩個不變的爻，以下面的「${title("changed", still[0])}」為主。`,
        focus: [{ hex: "changed", part: still[0], main: true }, { hex: "changed", part: still[1] }],
      };
    case 5:
      return {
        tip: `五爻動，以變卦中唯一不變的「${title("changed", still[0])}」爻辭為主。`,
        focus: [{ hex: "changed", part: still[0], main: true }],
      };
    default:
      if (primary.extra) {
        return {
          tip: `六爻皆動，${primary.name}卦看「${primary.name === "乾" ? "用九" : "用六"}」。`,
          focus: [{ hex: "primary", part: "extra", main: true }],
        };
      }
      return { tip: "六爻皆動，以變卦卦辭為主。", focus: [{ hex: "changed", part: "judgment", main: true }] };
  }
}

// 梅花易數的體用：有動爻的那一卦為「用」（事），另一卦為「體」（自己）
function tiYong(result) {
  const movingIndex = result.moving[0];
  const { upper, lower } = result.primary;
  const [ti, yong] = movingIndex >= 3 ? [lower, upper] : [upper, lower];
  const generates = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const a = TRIGRAMS[ti].element;
  const b = TRIGRAMS[yong].element;
  let relation, verdict;
  if (a === b) { relation = "體用比和"; verdict = "吉。彼此同氣相助，事情順遂。"; }
  else if (generates[b] === a) { relation = "用生體"; verdict = "大吉。外在環境助益自己，有進益之喜。"; }
  else if (generates[a] === b) { relation = "體生用"; verdict = "有耗損。自己付出多、回收少，宜量力而為。"; }
  else if (generates[generates[a]] === b) { relation = "體剋用"; verdict = "小吉。事情可成，但須費一番力氣。"; }
  else { relation = "用剋體"; verdict = "不利。外在壓力剋制自己，宜守不宜進。"; }
  return { ti, yong, tiElement: a, yongElement: b, relation, verdict };
}

// 讓 Node 也能載入做測試；在瀏覽器裡這段不會執行
if (typeof module !== "undefined") {
  module.exports = {
    TRIGRAMS, HEXAGRAMS, HEX_BY_BITS, lineTitle, castCoinLine, castYarrowLine,
    castMeihuaByTime, castMeihuaByNumbers, meihuaLines, interpret, readingGuide, tiYong,
  };
}
