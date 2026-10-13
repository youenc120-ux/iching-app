// 紫微斗數：依農曆生年月日時安命宮、定五行局、排十四主星與常用輔星、四化、大限。
// 宮位一律用地支序號表示：子 0、丑 1、寅 2 … 亥 11。
// 需要 divination.js（STEMS、BRANCHES）與 birth.js（lunarOf）。

const PALACE_NAMES = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"];
// 六十甲子納音五行（每兩個干支一組，共三十組），用來定五行局
const NAYIN = "金火木土金火水土金木水土火木水金火木土金火水土金木水土火木水";
const BUREAU = { 水: 2, 木: 3, 金: 4, 土: 5, 火: 6 };
const mod12 = (n) => ((n % 12) + 12) % 12;

// 紫微星系（由紫微逆數）與天府星系（由天府順數）的相對位置
const ZIWEI_GROUP = [["紫微", 0], ["天機", -1], ["太陽", -3], ["武曲", -4], ["天同", -5], ["廉貞", -8]];
const TIANFU_GROUP = [["天府", 0], ["太陰", 1], ["貪狼", 2], ["巨門", 3], ["天相", 4], ["天梁", 5], ["七殺", 6], ["破軍", 10]];

// 年干四化：祿、權、科、忌
const TRANSFORMS = [
  ["廉貞", "破軍", "武曲", "太陽"], ["天機", "天梁", "紫微", "太陰"], ["天同", "天機", "文昌", "廉貞"],
  ["太陰", "天同", "天機", "巨門"], ["貪狼", "太陰", "右弼", "天機"], ["武曲", "貪狼", "天梁", "文曲"],
  ["太陽", "武曲", "太陰", "天同"], ["巨門", "太陽", "文曲", "文昌"], ["天梁", "紫微", "左輔", "武曲"],
  ["破軍", "巨門", "太陰", "貪狼"],
];
const TRANSFORM_NAMES = ["祿", "權", "科", "忌"];

const LUCUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 祿存：甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子
const KUI = [1, 0, 11, 11, 1, 0, 1, 6, 3, 3]; // 天魁
const YUE = [7, 8, 9, 9, 7, 8, 7, 2, 5, 5]; // 天鉞
// 火星、鈴星的起點，依年支三合：申子辰、巳酉丑、寅午戌、亥卯未
const FIRE_START = [2, 3, 1, 9, 2, 3, 1, 9, 2, 3, 1, 9];
const BELL_START = [10, 10, 3, 10, 10, 10, 3, 10, 10, 10, 3, 10];
const HORSE = [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5]; // 天馬
const LIFE_LORD = ["貪狼", "巨門", "祿存", "文曲", "廉貞", "武曲", "破軍", "武曲", "廉貞", "文曲", "祿存", "巨門"];
const BODY_LORD = ["火星", "天相", "天梁", "天同", "文昌", "天機", "火星", "天相", "天梁", "天同", "文昌", "天機"];

function ziweiChart(birth) {
  // 晚上 11 點後算隔天的子時
  const shifted = new Date(Date.UTC(birth.year, birth.month - 1, birth.day + (birth.hour >= 23 ? 1 : 0)));
  const lunar = lunarOf(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  // 閏月：前半月算本月，後半月算下個月
  const month = lunar.leap && lunar.day > 15 ? (lunar.month % 12) + 1 : lunar.month;
  const hour = Math.floor(((birth.hour + 1) % 24) / 2);
  const yearIndex = (((lunar.year - 4) % 60) + 60) % 60;
  const yearStem = yearIndex % 10;
  const yearBranch = yearIndex % 12;

  // 命宮：寅宮起正月，順數到生月，再逆數到生時。身宮則順數到生時。
  const life = mod12(2 + month - 1 - hour);
  const body = mod12(2 + month - 1 + hour);

  // 宮干：五虎遁，由年干定寅宮天干
  const tigerStem = ((yearStem % 5) * 2 + 2) % 10;
  const stemOf = (branch) => (tigerStem + mod12(branch - 2)) % 10;

  // 五行局：命宮干支的納音
  const lifeSexagenary = (6 * stemOf(life) - 5 * life + 600) % 60;
  const bureauElement = NAYIN[Math.floor(lifeSexagenary / 2)];
  const bureau = BUREAU[bureauElement];

  // 紫微：生日補到能被局數整除，商數由寅宮起數；補的數是奇數就逆退、偶數就順進
  const pad = (bureau - (lunar.day % bureau)) % bureau;
  const quotient = (lunar.day + pad) / bureau;
  const ziwei = mod12(2 + quotient - 1 + (pad % 2 ? -pad : pad));
  const tianfu = mod12(4 - ziwei);

  const palaces = Array.from({ length: 12 }, (_, branch) => ({
    branch, stem: stemOf(branch), name: PALACE_NAMES[mod12(life - branch)],
    major: [], minor: [], isBody: branch === body,
  }));
  const put = (list, star, branch) => palaces[mod12(branch)][list].push({ name: star });
  ZIWEI_GROUP.forEach(([star, offset]) => put("major", star, ziwei + offset));
  TIANFU_GROUP.forEach(([star, offset]) => put("major", star, tianfu + offset));

  put("minor", "文昌", 10 - hour);
  put("minor", "文曲", 4 + hour);
  put("minor", "左輔", 4 + month - 1);
  put("minor", "右弼", 10 - (month - 1));
  put("minor", "天魁", KUI[yearStem]);
  put("minor", "天鉞", YUE[yearStem]);
  put("minor", "祿存", LUCUN[yearStem]);
  put("minor", "擎羊", LUCUN[yearStem] + 1);
  put("minor", "陀羅", LUCUN[yearStem] - 1);
  put("minor", "火星", FIRE_START[yearBranch] + hour);
  put("minor", "鈴星", BELL_START[yearBranch] + hour);
  put("minor", "地空", 11 - hour);
  put("minor", "地劫", 11 + hour);
  put("minor", "天馬", HORSE[yearBranch]);
  put("minor", "紅鸞", 3 - yearBranch);
  put("minor", "天喜", 9 - yearBranch);
  put("minor", "天刑", 9 + month - 1);
  put("minor", "天姚", 1 + month - 1);

  // 四化
  const transforms = TRANSFORMS[yearStem].map((star, i) => {
    for (const palace of palaces) {
      const hit = [...palace.major, ...palace.minor].find((s) => s.name === star);
      if (hit) { hit.transform = TRANSFORM_NAMES[i]; return { star, type: TRANSFORM_NAMES[i], palace: palace.name }; }
    }
    return null;
  });

  // 大限：由命宮起，陽男陰女順行、陰男陽女逆行，每宮十年，起始歲數等於局數
  const forward = (yearStem % 2 === 0) === (birth.gender === "male");
  palaces.forEach((palace) => {
    const steps = forward ? mod12(palace.branch - life) : mod12(life - palace.branch);
    palace.decade = [bureau + steps * 10, bureau + steps * 10 + 9];
  });

  return {
    lunar, month, hour, yearStem, yearBranch, life, body, bureau, bureauElement, palaces, transforms, forward,
    lifeLord: LIFE_LORD[life], bodyLord: BODY_LORD[yearBranch],
  };
}

// ── 解說文字 ──
const STAR_TEXTS = {
  紫微: "紫微是帝星，自尊心強、有領導慾，天生要當拿主意的人。缺點是耳根軟又愛面子，沒有得力幫手時容易孤高而成不了事。",
  天機: "天機是智慧星，腦筋動得快、善於企劃分析，心思多變。缺點是想太多、容易鑽牛角尖，適合動腦而不適合獨當一面扛責任。",
  太陽: "太陽主付出與名聲，熱心、直率、愛照顧人，重名大於重利。缺點是好面子、勞碌，付出多回收少。",
  武曲: "武曲是財星，剛毅、務實、執行力強，對錢有概念。缺點是個性硬、不懂變通，感情上比較孤、比較直。",
  天同: "天同是福星，溫和、樂觀、重享受，人緣好。缺點是懶散、缺乏企圖心，不被逼就不動。",
  廉貞: "廉貞亦正亦邪，聰明、有手腕、公關能力強，是非分明。缺點是好勝、情緒化，感情與是非都比別人多。",
  天府: "天府是財庫，穩重、保守、善於守成與管理。缺點是愛掌控、不願冒險，創業開拓不如守成。",
  太陰: "太陰主田宅與內在，細膩、溫柔、重感覺，擅長累積。缺點是多愁善感、優柔寡斷，容易把心事悶著。",
  貪狼: "貪狼是慾望與才藝之星，多才多藝、交際強、桃花旺。缺點是貪多、定性不足，什麼都想要而難專一。",
  巨門: "巨門主口舌，口才好、觀察入微、有研究精神。缺點是多疑、嘴上不饒人，容易惹是非。",
  天相: "天相是印星，穩重、公正、樂於助人，適合輔佐。缺點是沒有主見、容易受身邊的人影響，好壞看跟誰在一起。",
  天梁: "天梁是蔭星，老成、有原則、愛照顧人也愛管事。缺點是固執、好為人師，常常自找麻煩去解決別人的問題。",
  七殺: "七殺是將星，果斷、敢衝、不服輸，能獨當一面。缺點是衝動、孤傲，人生大起大落。",
  破軍: "破軍主破壞與開創，不安於現狀、敢砍掉重練。缺點是衝動、消耗大，守不住成果，一生變動多。",
};

const PALACE_TEXTS = {
  命宮: "命宮看的是你這個人本身：個性、格局與一生的基調。",
  夫妻: "夫妻宮看感情與婚姻，以及你會遇到什麼樣的對象。",
  財帛: "財帛宮看賺錢的方式與對金錢的態度。",
  官祿: "官祿宮看事業、工作型態與成就。",
  遷移: "遷移宮看外出、人際與在外的際遇，也是命宮的對照面。",
  疾厄: "疾厄宮看體質與容易出問題的地方。",
  福德: "福德宮看內心的滿足感與精神生活。",
};

const TRANSFORM_TEXTS = {
  祿: "化祿是好處與緣分所在：這個宮位的事情比較順、有收穫，但也容易因此放鬆。",
  權: "化權是掌控與企圖所在：你在這個宮位的事情上強勢、想主導，能成事也容易起爭執。",
  科: "化科是名聲與貴人所在：這個宮位的事情有人幫、有好名聲，但實質利益不一定多。",
  忌: "化忌是執著與虧欠所在：你在這個宮位的事情上最放不下、最容易卡關，是一生的功課。",
};

function renderZiwei(birth) {
  const chart = ziweiChart(birth);
  const root = document.querySelector("#result");
  root.replaceChildren();

  // 傳統命盤：四乘四的方格，外圈十二宮，中間寫基本資料
  const layout = [5, 6, 7, 8, 4, null, null, 9, 3, null, null, 10, 2, 1, 0, 11];
  const now = new Date().getFullYear();
  const age = now - chart.lunar.year + 1; // 虛歲
  const board = el("div", "ziwei-board");
  let centerPlaced = false;
  layout.forEach((branch) => {
    if (branch === null) {
      if (centerPlaced) return;
      centerPlaced = true;
      board.append(el("div", "ziwei-center", [
        el("div", "ziwei-title", `${chart.bureauElement}${"二三四五六"[chart.bureau - 2]}局`),
        el("p", null, `農曆 ${STEMS[chart.yearStem]}${BRANCHES[chart.yearBranch]}年 ${chart.lunar.leap ? "閏" : ""}${chart.lunar.month} 月 ${chart.lunar.day} 日 ${BRANCHES[chart.hour]}時`),
        el("p", null, `${birth.gender === "male" ? "男" : "女"}命 · 虛歲 ${age}`),
        el("p", null, `命主 ${chart.lifeLord} · 身主 ${chart.bodyLord}`),
        el("p", null, `大限${chart.forward ? "順" : "逆"}行`),
      ]));
      return;
    }
    const palace = chart.palaces[branch];
    const current = age >= palace.decade[0] && age <= palace.decade[1];
    const star = (s, cls) => el("span", cls, [s.name, s.transform ? el("b", `transform t-${s.transform}`, s.transform) : null]);
    board.append(el("div", `ziwei-cell${palace.name === "命宮" ? " life" : ""}${current ? " current" : ""}`, [
      el("div", "ziwei-major", palace.major.map((s) => star(s, "major"))),
      el("div", "ziwei-minor", palace.minor.map((s) => star(s, "minor"))),
      el("div", "ziwei-foot", [
        el("span", "ziwei-decade", `${palace.decade[0]}–${palace.decade[1]}`),
        el("span", "ziwei-name", palace.name + (palace.isBody ? "・身" : "")),
        el("span", "ziwei-gz", STEMS[palace.stem] + BRANCHES[palace.branch]),
      ]),
    ]));
  });
  root.append(el("section", "card", [el("h2", null, "命盤"), board,
    el("p", "hint", "框線加粗的是命宮，底色較深的是目前所在的大限。星名後的小字是生年四化。")]));

  // 解讀
  const reading = el("section", "card reading-card");
  reading.append(el("h2", null, "解讀"));
  const part = (title, text) => reading.append(el("div", "reading-part", [el("h5", null, title), el("p", null, text)]));
  const byName = (name) => chart.palaces.find((p) => p.name === name);
  const opposite = (palace) => chart.palaces[mod12(palace.branch + 6)];
  const starsOf = (palace) => {
    if (palace.major.length) return { stars: palace.major, borrowed: false };
    return { stars: opposite(palace).major, borrowed: true };
  };

  const life = byName("命宮");
  const lifeStars = starsOf(life);
  let lifeText = lifeStars.borrowed
    ? `你的命宮在${BRANCHES[life.branch]}，沒有主星（空宮），要借對宮遷移宮的星來看。空宮的人個性比較不固定，容易受環境和身邊的人影響。\n`
    : `你的命宮在${BRANCHES[life.branch]}，主星是${life.major.map((s) => s.name).join("、")}。\n`;
  lifeText += lifeStars.stars.map((s) => STAR_TEXTS[s.name]).join("\n");
  const helpers = life.minor.map((s) => s.name);
  const good = helpers.filter((n) => ["文昌", "文曲", "左輔", "右弼", "天魁", "天鉞", "祿存", "天馬"].includes(n));
  const bad = helpers.filter((n) => ["擎羊", "陀羅", "火星", "鈴星", "地空", "地劫"].includes(n));
  if (good.length) lifeText += `\n命宮有${good.join("、")}同宮，是助力，做事比較有人幫、有資源。`;
  if (bad.length) lifeText += `\n命宮有${bad.join("、")}同宮，是煞星，個性裡有衝、急或想法與現實落差的一面，人生波折也比較多。`;
  part("命宮", lifeText);

  const bodyPalace = chart.palaces.find((p) => p.isBody);
  part("身宮", `身宮在${bodyPalace.name}。身宮代表中年以後的重心與你實際花最多力氣的地方：`
    + ({ 命宮: "命身同宮，個性固定、主觀強，一輩子照自己的意思活。", 夫妻: "重心在感情與伴侶，另一半對你的影響很大。", 財帛: "重心在賺錢與理財，務實、重視經濟安全感。", 遷移: "重心在外面的世界，適合外出發展、常變動。", 官祿: "重心在事業與成就，工作佔去人生大半。", 福德: "重心在精神享受與興趣，重視自己過得開不開心。" }[bodyPalace.name] || "重心落在這個宮位的事情上。"));

  for (const name of ["官祿", "財帛", "夫妻"]) {
    const palace = byName(name);
    const { stars, borrowed } = starsOf(palace);
    const list = stars.map((s) => s.name).join("、") || "無";
    part(name, `${PALACE_TEXTS[name]}\n${borrowed ? `本宮無主星，借對宮的${list}來看。` : `主星是${list}。`}`
      + stars.map((s) => `\n${STAR_TEXTS[s.name]}`).join(""));
  }

  part("生年四化", chart.transforms.filter(Boolean).map((t) => `${t.star}化${t.type}，落在${t.palace}。${TRANSFORM_TEXTS[t.type]}`).join("\n"));

  const currentDecade = chart.palaces.find((p) => age >= p.decade[0] && age <= p.decade[1]);
  if (currentDecade) {
    const { stars, borrowed } = starsOf(currentDecade);
    part("目前的大限", `虛歲 ${currentDecade.decade[0]} 到 ${currentDecade.decade[1]} 歲，大限走到本命的${currentDecade.name}，`
      + `這十年的主題會圍繞著這個宮位代表的事情。${borrowed ? "宮內無主星，借對宮" : "宮內主星是"}${stars.map((s) => s.name).join("、") || "無"}。`);
  }

  reading.append(el("p", "hint", "這裡只排了十四主星和常用的輔星、煞星、生年四化，沒有納入星曜的廟旺利陷、流年、小限、飛星四化與雜曜；解說只看單宮主星，沒有論三方四正的組合。各門派對庚年四化、閏月等細節的排法並不一致。"));
  root.append(reading);
  root.hidden = false;
}

if (typeof document !== "undefined" && document.querySelector("#birth-form")) {
  birthForm(document.querySelector("#birth-form"), { place: false, button: "排命盤" }, renderZiwei);
}
