// 農民曆與擇日：國曆、農曆、節氣、干支、建除十二神、黃道黑道、宜忌、沖煞、彭祖百忌、時辰吉凶，
// 以及依事項挑選好日子。需要 divination.js（STEMS、BRANCHES、lunarOf）、lunar-data.js、najia.js（ganzhiAt、solarLongitudeAt）、
// birth.js（儲存的人）與 poster.js。
// 宜忌採建除十二神的通行說法（簡化版）；坊間農民曆會再綜合其他神煞，細節不一定相同。

const ZODIAC_ANIMALS = "鼠牛虎兔龍蛇馬羊猴雞狗豬";
const WEEKDAYS = "日一二三四五六";
const LUNAR_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "臘"];
const lunarDayName = (d) => (d <= 10 ? `初${"一二三四五六七八九十"[d - 1]}` : d < 20 ? `十${"一二三四五六七八九"[d - 11]}` : d === 20 ? "二十" : d < 30 ? `廿${"一二三四五六七八九"[d - 21]}` : "三十");

// 二十四節氣：太陽黃經每 15 度一個，0 度為春分
const TERMS = ["春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至", "小暑", "大暑", "立秋", "處暑", "白露",
  "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至", "小寒", "大寒", "立春", "雨水", "驚蟄"];

// 建除十二神：日支與月支（以節氣分月）的關係。yi 宜、ji 忌
const JIANCHU = [
  { name: "建", note: "萬物初生，宜開始、出發，不宜動土。", yi: ["出行", "上任", "祈福", "納財", "會友"], ji: ["動土", "修造", "安葬"] },
  { name: "除", note: "除舊布新，宜清掃、治病。", yi: ["祭祀", "求醫", "沐浴", "掃舍", "祈福"], ji: ["嫁娶", "移徙", "入宅"] },
  { name: "滿", note: "圓滿豐收，宜祈福、交易、納財。", yi: ["祭祀", "祈福", "開市", "交易", "立券", "納財"], ji: ["上任", "栽種", "安葬", "求醫"] },
  { name: "平", note: "平常之日，宜修整，大事不宜。", yi: ["修造", "祭祀", "掃舍"], ji: ["嫁娶", "開市", "移徙", "入宅", "栽種"] },
  { name: "定", note: "安定之日，宜婚嫁、訂約、入宅。", yi: ["嫁娶", "訂盟", "交易", "立券", "入宅", "祭祀", "祈福"], ji: ["訴訟", "出行", "求醫", "移徙"] },
  { name: "執", note: "執守之日，宜祭祀、立約，不宜遷動。", yi: ["祭祀", "祈福", "立券", "捕捉"], ji: ["開市", "出行", "移徙", "入宅"] },
  { name: "破", note: "月破大耗，諸事不宜，只宜拆除、求醫。", yi: ["求醫", "拆卸"], ji: ["嫁娶", "訂盟", "開市", "交易", "立券", "出行", "上任", "移徙", "入宅", "動土", "修造", "安葬", "祈福"] },
  { name: "危", note: "危險之日，凡事謹慎，不宜登高涉水。", yi: ["祭祀", "祈福", "安床"], ji: ["出行", "登高", "乘船", "嫁娶", "移徙"] },
  { name: "成", note: "成就之日，萬事可成，是一個月中最好的日子之一。", yi: ["嫁娶", "訂盟", "開市", "交易", "立券", "入宅", "移徙", "上任", "出行", "入學", "祈福"], ji: ["訴訟"] },
  { name: "收", note: "收成之日，宜納財、收帳。", yi: ["納財", "交易", "入學", "祭祀"], ji: ["出行", "安葬", "求醫"] },
  { name: "開", note: "開通之日，宜開業、嫁娶、出行。", yi: ["開市", "嫁娶", "入學", "上任", "出行", "動土", "修造", "入宅", "祈福"], ji: ["安葬"] },
  { name: "閉", note: "閉藏之日，宜收藏、安葬，不宜開創。", yi: ["安葬", "修造"], ji: ["開市", "出行", "求醫", "上任", "嫁娶", "入宅", "移徙"] },
];

// 黃道黑道十二神：依月支定青龍起於哪一日支，依序排下；時辰則依日支定起點
const DAY_GODS = ["青龍", "明堂", "天刑", "朱雀", "金匱", "天德", "白虎", "玉堂", "天牢", "玄武", "司命", "勾陳"];
const YELLOW_PATH = new Set(["青龍", "明堂", "金匱", "天德", "玉堂", "司命"]);
const DRAGON_START = [8, 10, 0, 2, 4, 6, 8, 10, 0, 2, 4, 6]; // 子午月起申、丑未月起戌、寅申月起子、卯酉起寅、辰戌起辰、巳亥起午
const godOf = (branch, startBranch) => DAY_GODS[((branch - startBranch) % 12 + 12) % 12];

// 彭祖百忌
const PENGZU_STEM = ["甲不開倉，財物耗散", "乙不栽植，千株不長", "丙不修灶，必見災殃", "丁不剃頭，頭必生瘡", "戊不受田，田主不祥",
  "己不破券，二比並亡", "庚不經絡，織機虛張", "辛不合醬，主人不嘗", "壬不泱水，更難提防", "癸不詞訟，理弱敵強"];
const PENGZU_BRANCH = ["子不問卜，自惹禍殃", "丑不冠帶，主不還鄉", "寅不祭祀，神鬼不嘗", "卯不穿井，水泉不香", "辰不哭泣，必主重喪",
  "巳不遠行，財物伏藏", "午不苫蓋，屋主更張", "未不服藥，毒氣入腸", "申不安床，鬼祟入房", "酉不會客，醉坐顛狂", "戌不吃犬，作怪上床", "亥不嫁娶，不利新郎"];
// 彭祖百忌對應到的事項（擇日時扣分）
const PENGZU_EVENT = { stem: { 0: ["納財"], 1: ["栽種"], 6: [], 5: ["立券", "交易"], 9: ["訴訟"] }, branch: { 5: ["出行"], 7: ["求醫"], 8: ["安床"], 11: ["嫁娶"], 9: ["會友"] } };

// 煞方：三合局的對沖方向
const SHA = { 0: "南", 4: "南", 8: "南", 2: "北", 6: "北", 10: "北", 5: "東", 9: "東", 1: "東", 11: "西", 3: "西", 7: "西" };

// 擇日可選的事項：顯示名稱 → 對應宜忌裡的詞
const EVENTS = [
  ["嫁娶", "結婚、嫁娶", ["嫁娶"]], ["訂盟", "訂婚、提親", ["訂盟", "嫁娶"]], ["入宅", "搬家、入厝", ["入宅", "移徙"]],
  ["開市", "開業、開工", ["開市"]], ["交易", "簽約、交易、買賣", ["交易", "立券"]], ["出行", "出遠門、旅行", ["出行"]],
  ["動土", "動土、裝修", ["動土", "修造"]], ["上任", "上任、到職", ["上任"]], ["求醫", "就醫、手術", ["求醫"]],
  ["祈福", "拜拜、祈福", ["祈福", "祭祀"]], ["安葬", "安葬", ["安葬"]], ["入學", "入學、考試", ["入學"]],
];

const FESTIVALS_LUNAR = { "1-1": "春節", "1-9": "天公生", "1-15": "元宵節", "2-2": "土地公生", "3-23": "媽祖生", "5-5": "端午節", "7-7": "七夕", "7-15": "中元節", "8-15": "中秋節", "9-9": "重陽節", "12-16": "尾牙", "12-24": "送神" };
const FESTIVALS_SOLAR = { "1-1": "元旦", "2-28": "和平紀念日", "4-4": "兒童節", "5-1": "勞動節", "10-10": "國慶日" };

// ── 推算某一天 ── y m d 為台灣當地日期；用當天中午的時刻判斷月份（節氣）
function almanacDay(y, m, d) {
  const noon = Date.UTC(y, m - 1, d, 4); // 台灣中午 12 點
  const gz = ganzhiAt(y, m, d, 12, noon);
  const dayStem = STEMS.indexOf(gz.day[0]), dayBranch = BRANCHES.indexOf(gz.day[1]);
  const monthBranch = BRANCHES.indexOf(gz.month[1]), yearBranch = BRANCHES.indexOf(gz.year[1]);
  const jianchu = JIANCHU[((dayBranch - monthBranch) % 12 + 12) % 12];
  const god = godOf(dayBranch, DRAGON_START[monthBranch]);
  const clash = (dayBranch + 6) % 12;
  const hours = BRANCHES.split("").map((b, i) => {
    const g = godOf(i, DRAGON_START[dayBranch]);
    const stem = STEMS[((dayStem % 5) * 2 + i) % 10];
    // 黃道時才算吉時，但和當日日支相沖的時辰（日破時）除外
    return { branch: b, stem, god: g, good: YELLOW_PATH.has(g) && i !== (dayBranch + 6) % 12, broken: i === (dayBranch + 6) % 12, clash: ZODIAC_ANIMALS[(i + 6) % 12], range: i === 0 ? "23–01" : `${String(i * 2 - 1).padStart(2, "0")}–${String(i * 2 + 1).padStart(2, "0")}` };
  });

  // 節氣：當天（台灣時間）太陽黃經跨過 15 度的倍數
  const startOfDay = Date.UTC(y, m - 1, d) - 8 * 3600000;
  const lonA = solarLongitudeAt(startOfDay), lonB = solarLongitudeAt(startOfDay + 86400000);
  const crossed = Math.floor(lonB / 15) !== Math.floor(lonA / 15) || (lonA > 345 && lonB < 15);
  const term = crossed ? TERMS[Math.floor(((lonB + (lonB < lonA ? 360 : 0)) / 15)) % 24] : null;

  const lunar = lunarOf(y, m, d);
  const lunarNext = lunarOf(...(() => { const t = new Date(Date.UTC(y, m - 1, d + 1)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; })());
  const festivals = [FESTIVALS_SOLAR[`${m}-${d}`], !lunar.leap && FESTIVALS_LUNAR[`${lunar.month}-${lunar.day}`],
    lunarNext.month === 1 && lunarNext.day === 1 && !lunarNext.leap ? "除夕" : null,
    term === "清明" ? "清明節" : null, term === "冬至" ? "冬至" : null].filter(Boolean);

  return {
    y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), gz, dayStem, dayBranch, monthBranch, yearBranch,
    lunar, jianchu, god, yellow: YELLOW_PATH.has(god), clash, clashAnimal: ZODIAC_ANIMALS[clash],
    clashPillar: STEMS[(dayStem + 6) % 10] + BRANCHES[clash], sha: SHA[dayBranch],
    pengzu: [PENGZU_STEM[dayStem], PENGZU_BRANCH[dayBranch]], hours, term, festivals,
    yearAnimal: ZODIAC_ANIMALS[yearBranch],
  };
}

// 下一個節氣在幾天後
function nextTerm(y, m, d) {
  for (let i = 1; i <= 17; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    const info = almanacDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    if (info.term) return { name: info.term, days: i, date: `${t.getUTCMonth() + 1}/${t.getUTCDate()}` };
  }
  return null;
}

// ── 個人：用儲存的生日算出生肖（年支）與日支 ──
function personPillars(person) {
  const birth = resolveBirth(person);
  const gz = ganzhiAt(birth.clock.year, birth.clock.month, birth.clock.day, birth.clock.hour, birthInstant(birth), true);
  return { name: person.name || "你", yearBranch: BRANCHES.indexOf(gz.year[1]), dayBranch: BRANCHES.indexOf(gz.day[1]) };
}

const SIX_HARMONY_PAIRS = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const isHarmony = (a, b) => SIX_HARMONY_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const isTrine = (a, b) => a !== b && a % 4 === b % 4;

function personalNote(day, p) {
  if (!p) return null;
  const animal = ZODIAC_ANIMALS[p.yearBranch];
  if (day.clash === p.yearBranch) return { tone: "bad", text: `今天沖${animal}：${p.name}屬${animal}，正好被沖到。重要的事（簽約、搬家、手術、大筆花費）能延就延，行事保守。` };
  if (day.clash === p.dayBranch) return { tone: "caution", text: `今天的日支沖到${p.name}八字裡的日支（代表自己與配偶），情緒和人際比較容易有摩擦。` };
  if (isHarmony(day.dayBranch, p.yearBranch)) return { tone: "good", text: `今天的日支與${p.name}的生肖${animal}六合，對你是助力日，適合談事情、求人幫忙。` };
  if (isTrine(day.dayBranch, p.yearBranch)) return { tone: "good", text: `今天的日支與${p.name}的生肖${animal}三合，做事比較順。` };
  return { tone: "neutral", text: `今天和${p.name}（屬${animal}）沒有特別的沖合，照農民曆的宜忌安排即可。` };
}

// ── 擇日：在日期範圍內為某件事評分 ──
function scoreDay(day, eventWords, person) {
  const reasons = [];
  let score = 0;
  if (eventWords.some((w) => day.jianchu.ji.includes(w))) return null; // 建除忌，直接排除
  if (person && day.clash === person.yearBranch) return null; // 沖到本人，直接排除
  if (eventWords.some((w) => day.jianchu.yi.includes(w))) { score += 4; reasons.push(`${day.jianchu.name}日宜此事`); }
  if (day.yellow) { score += 2; reasons.push(`黃道吉日（${day.god}）`); } else { score -= 1; }
  if (["成", "開", "定", "滿"].includes(day.jianchu.name)) { score += 1; }
  const pengzu = [...(PENGZU_EVENT.stem[day.dayStem] || []), ...(PENGZU_EVENT.branch[day.dayBranch] || [])];
  if (eventWords.some((w) => pengzu.includes(w))) { score -= 3; reasons.push(`彭祖百忌：${eventWords.some((w) => (PENGZU_EVENT.branch[day.dayBranch] || []).includes(w)) ? day.pengzu[1] : day.pengzu[0]}`); }
  if (day.dayBranch === (day.yearBranch + 6) % 12) { score -= 2; reasons.push("歲破日（沖太歲）"); }
  if (person) {
    if (day.clash === person.dayBranch) { score -= 2; reasons.push("沖到你的日支"); }
    if (isHarmony(day.dayBranch, person.yearBranch)) { score += 2; reasons.push("與你的生肖六合"); }
    else if (isTrine(day.dayBranch, person.yearBranch)) { score += 1; reasons.push("與你的生肖三合"); }
  }
  if (day.lunar.month === 7) { score -= 1; reasons.push("農曆七月，民間習俗多避開喜事"); }
  return score > 0 ? { day, score, reasons } : null;
}

function pickDays(eventKey, fromDate, days, person) {
  const event = EVENTS.find((e) => e[0] === eventKey);
  const results = [];
  for (let i = 0; i < days; i++) {
    const t = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i));
    const day = almanacDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    const s = scoreDay(day, event[2], person);
    if (s) results.push(s);
  }
  return results.sort((a, b) => b.score - a.score || (a.day.y - b.day.y) || (a.day.m - b.day.m) || (a.day.d - b.day.d)).slice(0, 12);
}

// 讓 Node 也能載入做測試
if (typeof module !== "undefined") module.exports = { almanacDay, pickDays, JIANCHU };
