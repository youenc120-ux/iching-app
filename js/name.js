// 姓名學：依康熙筆劃算天格、人格、地格、外格、總格（五格），再看八十一數理吉凶與三才（天人地）五行配置。
// 需要 name-strokes.js。採熊崎氏五格剖象法的通行算法；姓名學屬於民間方法，沒有經典依據。

// 八十一數理：[吉凶, 意象]。吉凶依通行的分類；26、27、30、36 等少數數字各家看法不同。
const NUMBER_FORTUNE = [null,
  ["大吉", "萬物開始、開創"], ["凶", "動搖不安、易分離"], ["大吉", "進取、名利雙收"], ["凶", "辛苦、易破敗"], ["大吉", "福祿長壽、和諧圓滿"],
  ["吉", "安穩、得天庇蔭"], ["吉", "剛毅獨立、有魄力"], ["吉", "意志堅強、勤勉有成"], ["大凶", "懷才不遇、窮迫"], ["大凶", "空虛、事多落空"],
  ["大吉", "穩健、重振家業"], ["凶", "意志薄弱、易受挫"], ["大吉", "聰明多才、有智慧"], ["大凶", "孤獨、家緣淡薄"], ["大吉", "福壽、慈祥得人緣"],
  ["大吉", "厚重、得貴人"], ["吉", "剛強、能突破困難"], ["吉", "有志竟成"], ["大凶", "多難、風雲蔽月"], ["大凶", "空虛、災厄多"],
  ["大吉", "獨立、能當首領"], ["凶", "秋草逢霜、難振作"], ["大吉", "旭日東昇、壯麗"], ["大吉", "白手起家、財運好"], ["吉", "資性聰明、英敏"],
  ["凶", "波瀾多、變化大（亦稱英雄數）"], ["半吉", "自我心強、易遭誹謗"], ["大凶", "遭難、離亂"], ["大吉", "有智謀、得財力"], ["半吉", "浮沉不定、吉凶難料"],
  ["大吉", "智勇兼備、能統率"], ["大吉", "僥倖、得貴人提攜"], ["大吉", "旭日升天、聲名顯達"], ["大凶", "破家、災禍"], ["吉", "溫和、平安"],
  ["凶", "波瀾重疊、俠義而勞"], ["大吉", "有權威、忠實"], ["半吉", "意志較弱、宜走藝術"], ["大吉", "富貴榮華"], ["凶", "投機、進退無常"],
  ["大吉", "德望高、純陽有成"], ["凶", "多才少成、寒蟬在柳"], ["凶", "外祥內苦、易散財"], ["大凶", "煩悶、易破家"], ["大吉", "順風、新生發達"],
  ["凶", "浪裡淘金、辛苦"], ["大吉", "點石成金、開花結果"], ["大吉", "德智兼備、古松立鶴"], ["凶", "吉凶轉變、難測"], ["凶", "一成一敗"],
  ["半吉", "盛衰交加"], ["大吉", "有先見、理想能實現"], ["凶", "外祥內苦、憂愁"], ["大凶", "辛勞多難"], ["半吉", "外美內苦"],
  ["凶", "浪裡行舟、歷盡艱辛"], ["吉", "寒雪青松、努力發達"], ["半吉", "先苦後甘"], ["凶", "失意、缺乏毅力"], ["大凶", "無謀、前途黑暗"],
  ["吉", "名利雙收"], ["凶", "基礎虛弱、衰敗"], ["大吉", "舟歸平海、富貴"], ["大凶", "沉浮不定、骨肉分離"], ["大吉", "富貴長壽"],
  ["凶", "進退兩難"], ["大吉", "獨營事業、順利"], ["吉", "思慮周密、有發明才能"], ["大凶", "坐立不安"], ["大凶", "寂寞、殘菊逢霜"],
  ["半吉", "石上金花、需努力"], ["凶", "先甘後苦"], ["半吉", "志高力微、宜守成"], ["大凶", "沉淪"], ["半吉", "退守可保吉"],
  ["大凶", "離散、傾覆"], ["半吉", "先苦後甘"], ["半吉", "先吉後凶、晚景宜防"], ["凶", "雲頭望月、不安"], ["凶", "一生辛苦、宜遁世修身"],
  ["大吉", "萬物回春、還原為一"],
];
const fortuneOf = (n) => NUMBER_FORTUNE[((n - 1) % 80) + 1];

// 數字尾數對應的五行：1、2 木，3、4 火，5、6 土，7、8 金，9、0 水
const ELEMENT_OF_DIGIT = ["水", "木", "木", "火", "火", "土", "土", "金", "金", "水"];
const elementOf = (n) => ELEMENT_OF_DIGIT[n % 10];
const GENERATE = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const OVERCOME = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };

function relation(a, b) {
  if (a === b) return "比和";
  if (GENERATE[a] === b) return "相生";
  if (GENERATE[b] === a) return "被生";
  if (OVERCOME[a] === b) return "相剋";
  return "被剋";
}

const GRID_ROLES = {
  天格: ["祖運", "祖先留下來的，不由自己決定，影響小；主要用來和人格配三才。"],
  人格: ["主運", "名字的核心，代表個性與一生的主要運勢，最重要。"],
  地格: ["前運", "代表青少年時期（約 36 歲前）的運勢、基礎與家庭環境。"],
  外格: ["副運", "代表人際關係、外在的助力與社交。"],
  總格: ["後運", "代表中年以後（約 36 歲後）的運勢與一生的總結。"],
};

// 姓名拆成姓與名：預設第一個字是姓；常見的複姓自動辨認
const COMPOUND_SURNAMES = ["歐陽", "司馬", "諸葛", "上官", "司徒", "東方", "皇甫", "公孫", "慕容", "夏侯", "長孫", "尉遲", "張簡", "范姜", "周黃", "張廖", "端木", "令狐", "宇文"];
function splitName(full) {
  const s = full.replace(/\s/g, "");
  const compound = COMPOUND_SURNAMES.find((c) => c.length === 2 && s.startsWith(c) && s.length > 2);
  return compound ? [compound, s.slice(2)] : [s.slice(0, 1), s.slice(1)];
}

// 五格
function fiveGrids(surnameStrokes, givenStrokes) {
  const [s1, s2] = surnameStrokes;
  const [g1, g2] = givenStrokes;
  const doubleSurname = surnameStrokes.length === 2, doubleGiven = givenStrokes.length >= 2;
  const lastSurname = doubleSurname ? s2 : s1;
  const sumS = surnameStrokes.reduce((a, b) => a + b, 0), sumG = givenStrokes.reduce((a, b) => a + b, 0);
  const 天格 = doubleSurname ? s1 + s2 : s1 + 1;
  const 人格 = lastSurname + g1;
  const 地格 = doubleGiven ? givenStrokes.reduce((a, b) => a + b, 0) : g1 + 1;
  const 總格 = sumS + sumG;
  const firstSurname = s1, lastGiven = doubleGiven ? givenStrokes[givenStrokes.length - 1] : 1;
  const 外格 = doubleSurname ? firstSurname + lastGiven : lastGiven + 1;
  return { 天格, 人格, 地格, 外格, 總格 };
}

// 三才：天格、人格、地格的五行相互關係
function threeTalents(grids) {
  const t = elementOf(grids.天格), r = elementOf(grids.人格), d = elementOf(grids.地格);
  const upper = relation(t, r), lower = relation(r, d);
  const good = (rel) => rel === "相生" || rel === "被生" || rel === "比和";
  const text = [];
  text.push(`天格與人格（${t}→${r}）${upper}：${upper === "相生" ? "長輩、上司的助力流向你，成功運順。" : upper === "被生" ? "你對長輩、上司付出較多。" : upper === "比和" ? "和上面的人同氣相求，關係平穩。" : upper === "相剋" ? "上面的人對你有壓力，成功之路多阻礙。" : "你和長輩、上司之間容易有衝突。"}`);
  text.push(`人格與地格（${r}→${d}）${lower}：${lower === "相生" ? "你照顧家庭與部屬，基礎穩固。" : lower === "被生" ? "家庭、部屬是你的助力，基礎穩固。" : lower === "比和" ? "家庭與基礎平穩。" : lower === "相剋" ? "你對家人、部屬要求多，關係較緊。" : "基礎不穩，容易被家庭或環境拖累。"}`);
  const verdict = good(upper) && good(lower) ? "吉" : !good(upper) && !good(lower) ? "凶" : "半吉";
  return { elements: [t, r, d], verdict, text };
}

// split：使用者自己指定的 [姓, 名]；沒給就自動拆
function nameReading(full, overrides = {}, split = null) {
  const [surname, given] = split || splitName(full);
  if (!surname || !given) return null;
  const strokeOf = (ch) => overrides[ch] ?? NAME_STROKES[ch] ?? null;
  const sChars = [...surname], gChars = [...given].slice(0, 3);
  const sStrokes = sChars.map(strokeOf), gStrokes = gChars.map(strokeOf);
  const unknown = [...sChars, ...gChars].filter((ch) => strokeOf(ch) == null);
  if (unknown.length) return { surname, given, chars: [...sChars, ...gChars], unknown };
  const grids = fiveGrids(sStrokes, gStrokes);
  const talents = threeTalents(grids);
  const entries = Object.entries(grids).map(([name, n]) => ({ name, n, fortune: fortuneOf(n), element: elementOf(n), role: GRID_ROLES[name] }));
  // 綜合：人格與總格最重要，地格、外格次之，天格只參考
  const points = { 大吉: 2, 吉: 1, 半吉: 0, 凶: -1, 大凶: -2 };
  const weight = { 天格: 0, 人格: 3, 地格: 2, 外格: 1, 總格: 3 };
  const score = entries.reduce((s, e) => s + points[e.fortune[0]] * weight[e.name], 0) + (talents.verdict === "吉" ? 2 : talents.verdict === "凶" ? -2 : 0);
  const level = score >= 12 ? 5 : score >= 6 ? 4 : score >= 0 ? 3 : score >= -6 ? 2 : 1;
  return { surname, given, chars: [...sChars, ...gChars], strokes: [...sStrokes, ...gStrokes], grids, entries, talents, score, level, unknown: [] };
}

if (typeof module !== "undefined") module.exports = { nameReading, splitName, fiveGrids };
