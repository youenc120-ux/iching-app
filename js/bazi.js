// 八字（四柱推命）：排四柱、十神、藏干、五行分布、日主強弱、大運與流年。
// 需要 divination.js（STEMS、BRANCHES）、najia.js（ganzhiAt、nearestJie、GENERATES、controls）、birth.js。

const STEM_ELEMENTS = "木木火火土土金金水水"; // 甲乙丙丁戊己庚辛壬癸
// 地支藏干：本氣、中氣、餘氣
const HIDDEN_STEMS = {
  子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙庚戊",
  午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲",
};
const HIDDEN_WEIGHTS = [1, 0.5, 0.3];
const ELEMENT_ORDER = "木火土金水";

// 十神：以日干為「我」，看五行生剋與陰陽是否相同
function tenGod(dayStem, otherStem) {
  const me = STEM_ELEMENTS[dayStem];
  const other = STEM_ELEMENTS[otherStem];
  const same = dayStem % 2 === otherStem % 2;
  if (other === me) return same ? "比肩" : "劫財";
  if (GENERATES[me] === other) return same ? "食神" : "傷官";
  if (controls(me, other)) return same ? "偏財" : "正財";
  if (controls(other, me)) return same ? "七殺" : "正官";
  return same ? "偏印" : "正印";
}

const DAY_MASTERS = [
  "甲木像大樹，直、硬、有主見，認定的方向不輕易彎。優點是可靠、有擔當，缺點是固執、不懂轉彎，被逼急了寧折不屈。",
  "乙木像藤蔓花草，柔軟、懂得借力，適應力強。優點是圓融、有韌性，缺點是依賴心重、容易看人臉色。",
  "丙火像太陽，熱情、直接、藏不住心事。優點是大方、有感染力，缺點是急躁、好面子，熱度來得快也退得快。",
  "丁火像燭火，細膩、敏感、有洞察力。優點是體貼、專注，缺點是多慮、情緒起伏，外表溫和內心其實很執著。",
  "戊土像高山厚土，穩重、守信、反應慢。優點是可靠、能扛事，缺點是保守、遲鈍，不喜歡變動。",
  "己土像田園之土，包容、務實、心思細。優點是有耐心、會照顧人，缺點是想太多、容易委屈自己又記在心裡。",
  "庚金像刀劍礦石，剛硬、果斷、講義氣。優點是有魄力、執行力強，缺點是衝動、說話傷人，不服輸。",
  "辛金像珠玉首飾，精緻、自尊心強、重視質感。優點是敏銳、有品味，缺點是挑剔、玻璃心，受不了被看輕。",
  "壬水像江河大海，聰明、靈活、不受拘束。優點是有謀略、適應力強，缺點是善變、任性，做事容易半途而廢。",
  "癸水像雨露，溫和、內斂、想像力豐富。優點是細心、有耐力，缺點是多疑、被動，心事重卻不說出口。",
];

const TEN_GOD_TEXTS = {
  比肩: "比肩重：自我意識強，凡事靠自己，不喜歡求人，也不容易聽勸。和朋友、同輩緣分深，但錢財容易被分走。",
  劫財: "劫財重：好勝、敢衝、講義氣，花錢大方。容易因為朋友或一時衝動破財，感情上也常有競爭者。",
  食神: "食神重：隨和、懂享受、有口福和才藝。做事不愛爭，人緣好，但容易安於現狀、缺乏企圖心。",
  傷官: "傷官重：聰明、有才華、表達力強，也因此看不慣規矩和上司。容易恃才傲物、說話得罪人。",
  偏財: "偏財重：對錢敏感、出手大方、交際手腕好，適合做生意或靠人脈。錢來得快去得也快，感情上異性緣多。",
  正財: "正財重：務實、節儉、重視穩定收入，靠一分耕耘一分收穫。缺點是計較、保守，不敢冒險。",
  七殺: "七殺重：壓力大、責任重，但也因此有魄力和決斷。個性強硬、不服輸，人生起伏大，容易與人起衝突。",
  正官: "正官重：守規矩、有責任感、重名聲，適合在體制內發展。缺點是拘謹、怕犯錯，被框架綁住。",
  偏印: "偏印重：想法獨特、學東西快，但興趣雜而不專。內心孤獨、多疑，不容易相信人。",
  正印: "正印重：有貴人和長輩照顧，愛學習、心地善良。缺點是依賴、想得多做得少，行動力不足。",
};

const ELEMENT_NOTES = {
  木: ["木過旺：主觀強、固執，容易鑽牛角尖。", "缺木：缺乏規劃和衝勁，容易猶豫、沒有主見。"],
  火: ["火過旺：急躁、衝動，做事三分鐘熱度。", "缺火：缺乏熱情和表現慾，容易顯得冷淡、不夠積極。"],
  土: ["土過旺：保守、固執，不願改變。", "缺土：缺乏穩定感，承諾和信用上容易出問題。"],
  金: ["金過旺：剛硬、好爭，容易得罪人。", "缺金：缺乏決斷力，該斷不斷、拖泥帶水。"],
  水: ["水過旺：想太多、善變，缺乏定性。", "缺水：缺乏彈性和機變，做事容易死板。"],
};

function baziChart(birth) {
  const instant = birthInstant(birth);
  const gz = ganzhiAt(birth.year, birth.month, birth.day, birth.hour, instant, true);
  const dayStem = gz.dayStem;
  const pillars = [
    { name: "年柱", stem: gz.yearIndex % 10, branch: gz.yearIndex % 12 },
    { name: "月柱", stem: gz.monthIndex[0], branch: gz.monthIndex[1] },
    { name: "日柱", stem: dayStem, branch: gz.dayIndex % 12 },
    { name: "時柱", stem: gz.hourIndex[0], branch: gz.hourIndex[1] },
  ].map((pillar, i) => ({
    ...pillar,
    stemGod: i === 2 ? "日主" : tenGod(dayStem, pillar.stem),
    hidden: [...HIDDEN_STEMS[BRANCHES[pillar.branch]]].map((stem) => {
      const index = STEMS.indexOf(stem);
      return { stem: index, god: tenGod(dayStem, index) };
    }),
  }));

  // 五行分布：天干各算 1，藏干依本氣、中氣、餘氣遞減；月支是月令，加重 1.5 倍
  const weights = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const gods = {};
  pillars.forEach((pillar, i) => {
    weights[STEM_ELEMENTS[pillar.stem]] += 1;
    if (i !== 2) gods[pillar.stemGod] = (gods[pillar.stemGod] || 0) + 1;
    pillar.hidden.forEach((hidden, k) => {
      const weight = HIDDEN_WEIGHTS[k] * (i === 1 ? 1.5 : 1);
      weights[STEM_ELEMENTS[hidden.stem]] += weight;
      gods[hidden.god] = (gods[hidden.god] || 0) + weight;
    });
  });
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  // 日主強弱：同我（比劫）與生我（印）的比重
  const me = STEM_ELEMENTS[dayStem];
  const mother = ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(me) + 4) % 5];
  const support = (weights[me] + weights[mother]) / total;
  const monthMain = STEM_ELEMENTS[pillars[1].hidden[0].stem];
  const inSeason = monthMain === me || monthMain === mother;
  const strength = support >= 0.55 || (support >= 0.48 && inSeason) ? "偏強" : support <= 0.38 || (support <= 0.45 && !inSeason) ? "偏弱" : "中和";
  const child = GENERATES[me];
  const wealth = GENERATES[child];
  const officer = GENERATES[wealth];
  const favorable = strength === "偏強" ? [child, wealth, officer] : strength === "偏弱" ? [mother, me] : [];

  // 大運：陽年男、陰年女順排，反之逆排；出生到最近一個節的天數，三天折一年
  const forward = (gz.yearIndex % 2 === 0) === (birth.gender === "male");
  const days = Math.abs(nearestJie(instant, forward) - instant) / 86400000;
  const startAge = days / 3;
  const monthSexagenary = (6 * pillars[1].stem - 5 * pillars[1].branch + 600) % 60;
  const luck = Array.from({ length: 8 }, (_, i) => {
    const index = (monthSexagenary + (forward ? i + 1 : -(i + 1)) + 600) % 60;
    const age = startAge + i * 10;
    return { stem: index % 10, branch: index % 12, age, year: Math.floor(birth.year + age), god: tenGod(dayStem, index % 10) };
  });

  return { gz, pillars, dayStem, me, weights, total, gods, support, inSeason, strength, favorable, forward, startAge, luck };
}

// ── 畫面 ──
const pairText = (stem, branch) => STEMS[stem] + BRANCHES[branch];

function renderBazi(birth) {
  const chart = baziChart(birth);
  const root = document.querySelector("#result");
  root.replaceChildren();

  // 四柱表（傳統由右到左是年月日時，這裡由左到右排時日月年，方便對照）
  const table = el("div", "pillars");
  for (const pillar of [...chart.pillars].reverse()) {
    table.append(el("div", `pillar${pillar.name === "日柱" ? " self" : ""}`, [
      el("div", "pillar-name", pillar.name),
      el("div", "pillar-god", pillar.stemGod),
      el("div", `pillar-char e-${STEM_ELEMENTS[pillar.stem]}`, STEMS[pillar.stem]),
      el("div", `pillar-char e-${BRANCH_ELEMENTS[pillar.branch]}`, BRANCHES[pillar.branch]),
      el("div", "pillar-hidden", pillar.hidden.map((h) => el("span", null, `${STEMS[h.stem]} ${h.god}`))),
    ]));
  }

  const bars = el("div", "element-bars", [...ELEMENT_ORDER].map((element) => {
    const share = chart.weights[element] / chart.total;
    const fill = el("i");
    fill.style.width = `${Math.round(share * 100)}%`;
    return el("div", `element-bar e-${element}${element === chart.me ? " self" : ""}`, [
      el("span", null, element), el("div", "track", [fill]), el("span", null, `${Math.round(share * 100)}%`),
    ]);
  }));

  root.append(el("section", "card", [
    el("h2", null, "四柱"),
    el("p", "meta", `${birth.year} 年 ${birth.month} 月 ${birth.day} 日 ${String(birth.hour).padStart(2, "0")}:${String(birth.minute).padStart(2, "0")} · ${birth.gender === "male" ? "男" : "女"}命 · 旬空 ${chart.gz.empty.join("")}`),
    table,
    el("h3", null, "五行分布"),
    bars,
  ]));

  // 解讀
  const reading = el("section", "card reading-card");
  reading.append(el("h2", null, "解讀"));
  const part = (title, text) => reading.append(el("div", "reading-part", [el("h5", null, title), el("p", null, text)]));

  part("日主", `你的日主是${STEMS[chart.dayStem]}${chart.me}。${DAY_MASTERS[chart.dayStem]}`);

  const supportText = `同類與生扶日主的五行佔 ${Math.round(chart.support * 100)}%，${chart.inSeason ? "出生的月份對日主有利（得令）" : "出生的月份對日主不利（失令）"}。`;
  const strengthText = {
    偏強: "日主偏強：你本身的能量夠，問題不在於撐不撐得住，而在於有沒有地方發揮。太強而無處洩，會變成固執、自以為是。",
    偏弱: "日主偏弱：你要扛的東西（財、事業、壓力）比你本身的能量大，容易覺得累、撐不住，需要靠學習、貴人、同伴來補。",
    中和: "日主中和：五行大致平衡，沒有明顯的偏枯。這是比較平穩的格局，好壞主要看大運走到哪裡。",
  }[chart.strength];
  const favorText = chart.favorable.length
    ? `\n喜用的五行是${chart.favorable.join("、")}：行到這些五行的大運流年比較順，可以多親近屬於它們的顏色、方位、行業；反過來的五行當旺時要保守。`
    : "";
  part("強弱與喜用", `${supportText}\n${strengthText}${favorText}`);

  const ranked = Object.entries(chart.gods).sort((a, b) => b[1] - a[1]);
  part("性格與際遇", ranked.slice(0, 2).map(([god]) => TEN_GOD_TEXTS[god]).join("\n"));

  const elementLines = [];
  for (const element of ELEMENT_ORDER) {
    const share = chart.weights[element] / chart.total;
    if (share >= 0.35) elementLines.push(ELEMENT_NOTES[element][0]);
    if (share <= 0.04) elementLines.push(ELEMENT_NOTES[element][1]);
  }
  if (elementLines.length) part("五行偏枯", elementLines.join("\n"));

  root.append(reading);

  // 大運與流年
  const now = new Date();
  const age = now.getFullYear() - birth.year;
  const luckRow = el("div", "luck-row", chart.luck.map((luck) => {
    const current = now.getFullYear() >= luck.year && now.getFullYear() < luck.year + 10;
    return el("div", `luck${current ? " current" : ""}`, [
      el("div", "luck-age", `${Math.floor(luck.age)} 歲起`),
      el("div", "pillar-char small", pairText(luck.stem, luck.branch)),
      el("div", "luck-god", luck.god),
      el("div", "luck-year", `${luck.year}`),
    ]);
  }));
  const yearIndex = (((now.getFullYear() - 4) % 60) + 60) % 60;
  const yearGod = tenGod(chart.dayStem, yearIndex % 10);
  const yearElement = STEM_ELEMENTS[yearIndex % 10];
  const yearNote = chart.favorable.length
    ? (chart.favorable.includes(yearElement) ? "天干是你的喜用五行，這一年相對順手。" : "天干不是你的喜用五行，這一年宜守不宜攻。")
    : "你的命局五行平衡，這一年沒有明顯的偏向。";
  const startYears = Math.floor(chart.startAge);
  const startMonths = Math.round((chart.startAge - startYears) * 12);
  root.append(el("section", "card", [
    el("h2", null, "大運與流年"),
    el("p", "meta", `${chart.forward ? "順" : "逆"}行，約 ${startYears} 歲 ${startMonths} 個月起運，每十年換一運。你現在約 ${age} 歲。`),
    luckRow,
    el("div", "guide", [
      el("h4", null, `今年（${now.getFullYear()} ${pairText(yearIndex % 10, yearIndex % 12)}年）`),
      el("p", null, `流年天干${STEMS[yearIndex % 10]}${yearElement}，對你是${yearGod}。${yearNote}`),
    ]),
    el("p", "hint", "這裡的強弱與喜用是用五行比重估算的簡易判斷，沒有細論格局、調候、刑沖合害與神煞。年、月以節氣為界；晚上 11 點後出生，日柱算隔天。"),
  ]));
  root.hidden = false;
}

if (typeof document !== "undefined" && document.querySelector("#birth-form")) {
  birthForm(document.querySelector("#birth-form"), { place: false, button: "排八字" }, renderBazi);
}
